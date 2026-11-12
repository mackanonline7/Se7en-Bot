import type { Approval, HistoryMessage, Runtime, StreamEvent } from '../hermes/client';

export type MessageStatus = 'sending' | 'sent' | 'failed' | 'waiting' | 'streaming' | 'error';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
  status: MessageStatus;
};

// Hermes streams tools as they run, so there are no known-ahead "pending" steps.
export type StepState = 'done' | 'active' | 'failed';
export type Step = { name: string; label: string; state: StepState };

// The turn this app is running right now; Hermes exposes no cross-client "current task".
export type Run = {
  runId: string | null;
  title: string;
  startedAt: number;
  steps: Step[];
  approvals: Approval[];
};

export type ChatState = {
  sessionId: string | null;
  messages: ChatMessage[]; // oldest first
  loading: 'idle' | 'loading' | 'failed';
  run: Run | null;
  runtime: Runtime | null;
};

export type ChatAction =
  | { type: 'new' }
  | { type: 'open'; sessionId: string }
  | { type: 'loaded'; sessionId: string; messages: HistoryMessage[] }
  | { type: 'loadFailed'; sessionId: string }
  | { type: 'send'; text: string; userId: string; assistantId: string; at: number }
  | { type: 'sessionCreated'; sessionId: string }
  | { type: 'sendFailed'; userId: string; assistantId: string }
  | { type: 'stream'; assistantId: string; event: StreamEvent }
  | { type: 'approvalResolved'; approval: Approval }
  | { type: 'remove'; id: string };

export const initialChat: ChatState = { sessionId: null, messages: [], loading: 'idle', run: null, runtime: null };

const patch = (messages: ChatMessage[], id: string, change: (m: ChatMessage) => Partial<ChatMessage>) =>
  messages.map((m) => (m.id === id ? { ...m, ...change(m) } : m));

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'new':
      return { ...initialChat, runtime: state.runtime };
    case 'open':
      return { ...initialChat, runtime: state.runtime, sessionId: action.sessionId, loading: 'loading' };
    case 'loaded':
      if (action.sessionId !== state.sessionId) return state;
      return { ...state, loading: 'idle', messages: action.messages.map((m) => ({ ...m, status: 'sent' })) };
    case 'loadFailed':
      return action.sessionId === state.sessionId ? { ...state, loading: 'failed' } : state;
    case 'send':
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: action.userId, role: 'user', text: action.text, createdAt: action.at, status: 'sending' },
          { id: action.assistantId, role: 'assistant', text: '', createdAt: action.at, status: 'waiting' },
        ],
        run: { runId: null, title: action.text, startedAt: action.at, steps: [], approvals: [] },
      };
    case 'sessionCreated':
      return { ...state, sessionId: action.sessionId };
    case 'sendFailed':
      return {
        ...state,
        run: null,
        messages: patch(
          state.messages.filter((m) => m.id !== action.assistantId),
          action.userId,
          () => ({ status: 'failed' }),
        ),
      };
    case 'stream':
      return applyStreamEvent(state, action.assistantId, action.event);
    case 'approvalResolved':
      return state.run
        ? { ...state, run: { ...state.run, approvals: state.run.approvals.filter((a) => a !== action.approval) } }
        : state;
    case 'remove':
      return { ...state, messages: state.messages.filter((m) => m.id !== action.id) };
  }
}

function applyStreamEvent(state: ChatState, assistantId: string, e: StreamEvent): ChatState {
  const run = state.run;
  switch (e.type) {
    case 'started':
      return {
        ...state,
        messages: state.messages.map((m) => (m.status === 'sending' ? { ...m, status: 'sent' } : m)),
        run: run && { ...run, runId: e.runId },
      };
    case 'delta':
      return { ...state, messages: patch(state.messages, assistantId, (m) => ({ text: m.text + e.text, status: 'streaming' })) };
    case 'tool': {
      if (!run) return state;
      let steps = run.steps;
      if (e.state === 'started') {
        // agent.md › Nytt steg: appended last; the previous active step becomes done.
        steps = [
          ...steps.map((s) => (s.state === 'active' ? { ...s, state: 'done' as const } : s)),
          { name: e.name, label: e.preview || e.name, state: 'active' },
        ];
      } else {
        // A failure may arrive after a newer step already marked this one done.
        const i = steps.findLastIndex((s) => s.name === e.name && (s.state === 'active' || e.state === 'failed'));
        if (i !== -1) steps = steps.map((s, j) => (j === i ? { ...s, state: e.state === 'failed' ? 'failed' : 'done' } : s));
      }
      return { ...state, run: { ...run, steps } };
    }
    case 'approval':
      return run ? { ...state, run: { ...run, approvals: [...run.approvals, e.approval] } } : state;
    case 'completed':
      return {
        ...state,
        runtime: e.runtime.model ? e.runtime : state.runtime,
        messages: patch(state.messages, assistantId, (m) => ({ text: e.text || m.text })),
      };
    case 'end': {
      if (!run) return state; // the turn already ended
      const answer = state.messages.find((m) => m.id === assistantId);
      if (e.status === 'cancelled' && !answer?.text) {
        return { ...state, run: null, messages: state.messages.filter((m) => m.id !== assistantId) };
      }
      const status: MessageStatus = e.status === 'failed' ? 'error' : 'sent';
      return { ...state, run: null, messages: patch(state.messages, assistantId, () => ({ status })) };
    }
    case 'error':
      if (!run) return state;
      return { ...state, run: null, messages: patch(state.messages, assistantId, () => ({ status: 'error' })) };
  }
}
