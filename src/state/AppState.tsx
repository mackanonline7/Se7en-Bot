import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { hermes, HermesError, type Approval, type Connection, type Session } from '../hermes/client';
import { chatReducer, initialChat, type ChatState } from './chat';

const URL_KEY = 'hermes.url';
const TOKEN_KEY = 'hermes.token';

export type ConnStatus = 'loading' | 'none' | 'connected' | 'offline';
export type SessionsState = { list: Session[]; status: 'loading' | 'ok' | 'failed' };

type AppState = {
  conn: Connection | null;
  connStatus: ConnStatus;
  connect(url: string, token: string): Promise<void>;
  disconnect(): Promise<void>;
  reconnect(): void;
  chat: ChatState;
  send(text: string): void;
  retry(messageId: string): void;
  stop(): void;
  openSession(id: string): void;
  newChat(): void;
  respondApproval(approval: Approval, choice: 'once' | 'deny'): Promise<void>;
  sessions: SessionsState;
  refreshSessions(): void;
  deleteSession(id: string): Promise<void>;
  renameSession(id: string, title: string): Promise<void>;
};

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const value = useContext(Ctx);
  if (!value) throw new Error('useApp outside AppProvider');
  return value;
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const unreachable = (e: unknown) => e instanceof HermesError && e.code === 'unreachable';

export function AppProvider({ children }: { children: ReactNode }) {
  const [conn, setConn] = useState<Connection | null>(null);
  const [connStatus, setConnStatus] = useState<ConnStatus>('loading');
  const [chat, dispatch] = useReducer(chatReducer, initialChat);
  const [sessions, setSessions] = useState<SessionsState>({ list: [], status: 'loading' });
  const chatRef = useRef(chat);
  chatRef.current = chat;
  const abortRef = useRef<AbortController | null>(null);

  const fail = useCallback((e: unknown) => {
    if (unreachable(e)) setConnStatus('offline');
  }, []);

  const refreshSessions = useCallback(() => {
    if (!conn) return;
    setSessions((s) => ({ ...s, status: s.list.length ? s.status : 'loading' }));
    hermes.listSessions(conn).then(
      (list) => {
        setSessions({ list, status: 'ok' });
        setConnStatus('connected');
      },
      (e) => {
        setSessions((s) => ({ ...s, status: 'failed' }));
        // On launch any failure (also a revoked token) means we are not connected.
        setConnStatus((s) => (s === 'loading' || unreachable(e) ? 'offline' : s));
      },
    );
  }, [conn]);

  // Restore the saved server on launch.
  useEffect(() => {
    (async () => {
      const [url, token] = await Promise.all([AsyncStorage.getItem(URL_KEY), SecureStore.getItemAsync(TOKEN_KEY)]);
      if (url && token) setConn({ url, token });
      else setConnStatus('none');
    })();
  }, []);

  useEffect(() => {
    if (conn) refreshSessions();
  }, [conn, refreshSessions]);

  const connect = useCallback(async (url: string, token: string) => {
    const next = { url: url.trim(), token: token.trim() };
    await hermes.verify(next);
    await Promise.all([AsyncStorage.setItem(URL_KEY, next.url), SecureStore.setItemAsync(TOKEN_KEY, next.token)]);
    dispatch({ type: 'new' });
    setConn(next);
    setConnStatus('connected');
  }, []);

  const disconnect = useCallback(async () => {
    abortRef.current?.abort();
    await Promise.all([AsyncStorage.removeItem(URL_KEY), SecureStore.deleteItemAsync(TOKEN_KEY)]);
    dispatch({ type: 'new' });
    setConn(null);
    setSessions({ list: [], status: 'loading' });
    setConnStatus('none');
  }, []);

  const reconnect = useCallback(() => {
    if (!conn) return;
    hermes.verify(conn).then(() => {
      setConnStatus('connected');
      refreshSessions();
    }, fail);
  }, [conn, fail, refreshSessions]);

  const send = useCallback(
    async (text: string) => {
      if (!conn || chatRef.current.run || !text.trim()) return;
      const userId = uid();
      const assistantId = uid();
      dispatch({ type: 'send', text, userId, assistantId, at: Date.now() });
      const controller = new AbortController();
      abortRef.current = controller;
      let started = false;
      try {
        let sessionId = chatRef.current.sessionId;
        if (!sessionId) {
          sessionId = await hermes.createSession(conn);
          dispatch({ type: 'sessionCreated', sessionId });
        }
        await hermes.chatStream(
          conn,
          sessionId,
          text,
          (event) => {
            if (event.type === 'started') started = true;
            dispatch({ type: 'stream', assistantId, event });
          },
          controller.signal,
        );
        // A stream that closed without a terminal event did not finish.
        dispatch({
          type: 'stream',
          assistantId,
          event: { type: 'end', status: controller.signal.aborted ? 'cancelled' : 'failed' },
        });
        refreshSessions();
      } catch (e) {
        if (started) dispatch({ type: 'stream', assistantId, event: { type: 'error', message: String(e) } });
        else dispatch({ type: 'sendFailed', userId, assistantId });
        fail(e);
      }
    },
    [conn, fail, refreshSessions],
  );

  const retry = useCallback(
    (messageId: string) => {
      const { messages } = chatRef.current;
      const i = messages.findIndex((m) => m.id === messageId);
      if (i === -1) return;
      const user = messages[i].role === 'user' ? messages[i] : messages.slice(0, i).reverse().find((m) => m.role === 'user');
      if (!user) return;
      dispatch({ type: 'remove', id: messageId });
      if (user.id !== messageId) dispatch({ type: 'remove', id: user.id });
      send(user.text);
    },
    [send],
  );

  const stop = useCallback(() => {
    const runId = chatRef.current.run?.runId;
    // Hermes interrupts the turn when the stream closes; /stop is the explicit route.
    if (conn && runId) hermes.stopRun(conn, runId).catch(() => abortRef.current?.abort());
    else abortRef.current?.abort();
  }, [conn]);

  const openSession = useCallback(
    (id: string) => {
      if (!conn || chatRef.current.run) return;
      dispatch({ type: 'open', sessionId: id });
      hermes.messages(conn, id).then(
        (messages) => dispatch({ type: 'loaded', sessionId: id, messages }),
        (e) => {
          dispatch({ type: 'loadFailed', sessionId: id });
          fail(e);
        },
      );
    },
    [conn, fail],
  );

  const newChat = useCallback(() => {
    if (!chatRef.current.run) dispatch({ type: 'new' });
  }, []);

  const respondApproval = useCallback(
    async (approval: Approval, choice: 'once' | 'deny') => {
      const runId = chatRef.current.run?.runId;
      if (!conn || !runId) return;
      await hermes.respondApproval(conn, runId, approval, choice);
      dispatch({ type: 'approvalResolved', approval });
    },
    [conn],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      if (!conn) return;
      await hermes.deleteSession(conn, id);
      if (chatRef.current.sessionId === id) dispatch({ type: 'new' });
      setSessions((s) => ({ ...s, list: s.list.filter((x) => x.id !== id) }));
    },
    [conn],
  );

  const renameSession = useCallback(
    async (id: string, title: string) => {
      if (!conn) return;
      await hermes.renameSession(conn, id, title);
      setSessions((s) => ({ ...s, list: s.list.map((x) => (x.id === id ? { ...x, title } : x)) }));
    },
    [conn],
  );

  return (
    <Ctx.Provider
      value={{
        conn,
        connStatus,
        connect,
        disconnect,
        reconnect,
        chat,
        send,
        retry,
        stop,
        openSession,
        newChat,
        respondApproval,
        sessions,
        refreshSessions,
        deleteSession,
        renameSession,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
