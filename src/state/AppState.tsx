import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { hermes, HermesError, type Approval, type Connection, type Runtime, type Session } from '../hermes/client';
import { emptyStore, latestSession, parseStore, visibleSessions, type Bot, type BotStore } from './bots';
import { chatReducer, initialChat, type ChatAction, type ChatState } from './chat';

const URL_KEY = 'hermes.url';
const TOKEN_KEY = 'hermes.token';
const BOTS_KEY = 'bots.v1';

// A chat slot: one open conversation per bot, plus one for conversations without a bot.
export type ChatKey = string;
export const NO_BOT: ChatKey = '';

export type ConnStatus = 'loading' | 'none' | 'connected' | 'offline';
export type SessionsState = { list: Session[]; status: 'loading' | 'ok' | 'failed' };
export type BotDraft = Pick<Bot, 'name' | 'shape' | 'color'>;

type Chats = Record<ChatKey, ChatState>;
type ChatsAction = { key: ChatKey; action: ChatAction } | { reset: true } | { drop: ChatKey };

function chatsReducer(state: Chats, a: ChatsAction): Chats {
  if ('reset' in a) return {};
  if ('drop' in a) {
    const { [a.drop]: _dropped, ...rest } = state;
    return rest;
  }
  return { ...state, [a.key]: chatReducer(state[a.key] ?? initialChat, a.action) };
}

type AppState = {
  conn: Connection | null;
  connStatus: ConnStatus;
  connect(url: string, token: string): Promise<void>;
  disconnect(): Promise<void>;
  reconnect(): void;
  chats: Chats;
  runtime: Runtime | null;
  send(key: ChatKey, text: string): void;
  retry(key: ChatKey, messageId: string): void;
  stop(key: ChatKey): void;
  newChat(key: ChatKey): void;
  openBot(botId: string): void;
  openSession(id: string): ChatKey;
  respondApproval(key: ChatKey, approval: Approval, choice: 'once' | 'deny'): Promise<void>;
  sessions: SessionsState;
  refreshSessions(): void;
  deleteSession(id: string): Promise<void>;
  renameSession(id: string, title: string): Promise<void>;
  store: BotStore;
  botsStatus: 'loading' | 'ok' | 'failed';
  reloadBots(): void;
  saveBot(draft: BotDraft, id?: string): Promise<Bot>;
  deleteBot(id: string): Promise<void>;
};

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const value = useContext(Ctx);
  if (!value) throw new Error('useApp outside AppProvider');
  return value;
}

export function useChat(key: ChatKey): ChatState {
  return useApp().chats[key] ?? initialChat;
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const unreachable = (e: unknown) => e instanceof HermesError && e.code === 'unreachable';

export function AppProvider({ children }: { children: ReactNode }) {
  const [conn, setConn] = useState<Connection | null>(null);
  const [connStatus, setConnStatus] = useState<ConnStatus>('loading');
  const [chats, dispatch] = useReducer(chatsReducer, {});
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [allSessions, setSessions] = useState<SessionsState>({ list: [], status: 'loading' });
  const [store, setStore] = useState<BotStore>(emptyStore);
  const [botsStatus, setBotsStatus] = useState<AppState['botsStatus']>('loading');
  const chatsRef = useRef(chats);
  chatsRef.current = chats;
  const storeRef = useRef(store);
  storeRef.current = store;
  const sessionsRef = useRef(allSessions);
  sessionsRef.current = allSessions;
  const aborts = useRef(new Map<ChatKey, AbortController>());

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

  const reloadBots = useCallback(() => {
    setBotsStatus('loading');
    AsyncStorage.getItem(BOTS_KEY)
      .then(parseStore)
      .then(
        (loaded) => {
          setStore(loaded);
          setBotsStatus('ok');
        },
        () => setBotsStatus('failed'),
      );
  }, []);

  // Restore the saved server and the bots on launch.
  useEffect(() => {
    reloadBots();
    (async () => {
      const [url, token] = await Promise.all([AsyncStorage.getItem(URL_KEY), SecureStore.getItemAsync(TOKEN_KEY)]);
      if (url && token) setConn({ url, token });
      else setConnStatus('none');
    })();
  }, [reloadBots]);

  useEffect(() => {
    if (conn) refreshSessions();
  }, [conn, refreshSessions]);

  const persist = useCallback(async (next: BotStore) => {
    await AsyncStorage.setItem(BOTS_KEY, JSON.stringify(next));
    storeRef.current = next;
    setStore(next);
  }, []);

  const abortAll = () => {
    aborts.current.forEach((c) => c.abort());
    aborts.current.clear();
  };

  const connect = useCallback(async (url: string, token: string) => {
    const next = { url: url.trim(), token: token.trim() };
    await hermes.verify(next);
    await Promise.all([AsyncStorage.setItem(URL_KEY, next.url), SecureStore.setItemAsync(TOKEN_KEY, next.token)]);
    abortAll();
    dispatch({ reset: true });
    setConn(next);
    setConnStatus('connected');
  }, []);

  const disconnect = useCallback(async () => {
    abortAll();
    await Promise.all([AsyncStorage.removeItem(URL_KEY), SecureStore.deleteItemAsync(TOKEN_KEY)]);
    dispatch({ reset: true });
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
    async (key: ChatKey, text: string) => {
      const current = chatsRef.current[key] ?? initialChat;
      if (!conn || current.run || !text.trim()) return;
      const userId = uid();
      const assistantId = uid();
      dispatch({ key, action: { type: 'send', text, userId, assistantId, at: Date.now() } });
      const controller = new AbortController();
      aborts.current.set(key, controller);
      let started = false;
      try {
        let sessionId = current.sessionId;
        if (!sessionId) {
          sessionId = await hermes.createSession(conn);
          dispatch({ key, action: { type: 'sessionCreated', sessionId } });
          // Remember which bot the conversation belongs to. If the write fails the
          // link still holds for this launch.
          if (key !== NO_BOT) {
            const next = { ...storeRef.current, conversations: { ...storeRef.current.conversations, [sessionId]: key } };
            persist(next).catch(() => setStore(next));
          }
        }
        await hermes.chatStream(
          conn,
          sessionId,
          text,
          (event) => {
            if (event.type === 'started') started = true;
            if (event.type === 'completed' && event.runtime.model) setRuntime(event.runtime);
            dispatch({ key, action: { type: 'stream', assistantId, event } });
          },
          controller.signal,
        );
        // A stream that closed without a terminal event did not finish.
        dispatch({
          key,
          action: { type: 'stream', assistantId, event: { type: 'end', status: controller.signal.aborted ? 'cancelled' : 'failed' } },
        });
        refreshSessions();
      } catch (e) {
        if (started) dispatch({ key, action: { type: 'stream', assistantId, event: { type: 'error', message: String(e) } } });
        else dispatch({ key, action: { type: 'sendFailed', userId, assistantId } });
        fail(e);
      } finally {
        if (aborts.current.get(key) === controller) aborts.current.delete(key);
      }
    },
    [conn, fail, persist, refreshSessions],
  );

  const retry = useCallback(
    (key: ChatKey, messageId: string) => {
      const { messages } = chatsRef.current[key] ?? initialChat;
      const i = messages.findIndex((m) => m.id === messageId);
      if (i === -1) return;
      const user = messages[i].role === 'user' ? messages[i] : messages.slice(0, i).reverse().find((m) => m.role === 'user');
      if (!user) return;
      dispatch({ key, action: { type: 'remove', id: messageId } });
      if (user.id !== messageId) dispatch({ key, action: { type: 'remove', id: user.id } });
      send(key, user.text);
    },
    [send],
  );

  const stop = useCallback(
    (key: ChatKey) => {
      const runId = chatsRef.current[key]?.run?.runId;
      const abort = () => aborts.current.get(key)?.abort();
      // Hermes interrupts the turn when the stream closes; /stop is the explicit route.
      if (conn && runId) hermes.stopRun(conn, runId).catch(abort);
      else abort();
    },
    [conn],
  );

  const load = useCallback(
    (key: ChatKey, id: string) => {
      if (!conn) return;
      dispatch({ key, action: { type: 'open', sessionId: id } });
      hermes.messages(conn, id).then(
        (messages) => dispatch({ key, action: { type: 'loaded', sessionId: id, messages } }),
        (e) => {
          dispatch({ key, action: { type: 'loadFailed', sessionId: id } });
          fail(e);
        },
      );
    },
    [conn, fail],
  );

  // bots.md: opens the bot's latest conversation, or a new empty one.
  const openBot = useCallback(
    (botId: string) => {
      const chat = chatsRef.current[botId];
      if (chat?.run || chat?.sessionId || chat?.messages.length) return;
      const latest = latestSession(sessionsRef.current.list, storeRef.current, botId);
      if (latest) load(botId, latest.id);
    },
    [load],
  );

  const openSession = useCallback(
    (id: string): ChatKey => {
      const key = storeRef.current.conversations[id] ?? NO_BOT;
      const chat = chatsRef.current[key];
      const alreadyOpen = chat?.sessionId === id && chat.loading !== 'failed';
      if (!chat?.run && !alreadyOpen) load(key, id);
      return key;
    },
    [load],
  );

  const newChat = useCallback((key: ChatKey) => {
    if (!chatsRef.current[key]?.run) dispatch({ key, action: { type: 'new' } });
  }, []);

  const respondApproval = useCallback(
    async (key: ChatKey, approval: Approval, choice: 'once' | 'deny') => {
      const runId = chatsRef.current[key]?.run?.runId;
      if (!conn || !runId) return;
      await hermes.respondApproval(conn, runId, approval, choice);
      dispatch({ key, action: { type: 'approvalResolved', approval } });
    },
    [conn],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      if (!conn) return;
      await hermes.deleteSession(conn, id);
      for (const [key, chat] of Object.entries(chatsRef.current)) {
        if (chat.sessionId === id) dispatch({ key, action: { type: 'new' } });
      }
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

  const saveBot = useCallback(
    async (draft: BotDraft, id?: string): Promise<Bot> => {
      const now = Date.now();
      const { bots } = storeRef.current;
      const existing = bots.find((b) => b.id === id);
      const bot: Bot = existing
        ? { ...existing, ...draft, name: draft.name.trim(), updatedAt: now }
        : { id: uid(), ...draft, name: draft.name.trim(), createdAt: now, updatedAt: now };
      await persist({ ...storeRef.current, bots: existing ? bots.map((b) => (b.id === bot.id ? bot : b)) : [...bots, bot] });
      return bot;
    },
    [persist],
  );

  // Local only: the bot's conversations stay in Hermes but leave the app, because
  // their link to the missing bot is kept (see visibleSessions).
  const deleteBot = useCallback(
    async (id: string) => {
      await persist({ ...storeRef.current, bots: storeRef.current.bots.filter((b) => b.id !== id) });
      stop(id);
      aborts.current.get(id)?.abort();
      dispatch({ drop: id });
    },
    [persist, stop],
  );

  const sessions = useMemo(() => ({ ...allSessions, list: visibleSessions(allSessions.list, store) }), [allSessions, store]);

  return (
    <Ctx.Provider
      value={{
        conn,
        connStatus,
        connect,
        disconnect,
        reconnect,
        chats,
        runtime,
        send,
        retry,
        stop,
        newChat,
        openBot,
        openSession,
        respondApproval,
        sessions,
        refreshSessions,
        deleteSession,
        renameSession,
        store,
        botsStatus,
        reloadBots,
        saveBot,
        deleteBot,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
