// Bots live on the phone only: Hermes has no bot concept (bots.md › Data).
import type { Session } from '../hermes/client';
import type { ChatState } from './chat';

export const SHAPES = [
  { id: 'circle', name: 'Cirkel' },
  { id: 'square', name: 'Ruta' },
  { id: 'hexagon', name: 'Hexagon' },
  { id: 'clover', name: 'Klöver' },
  { id: 'drop', name: 'Droppe' },
  { id: 'triangle', name: 'Triangel' },
  { id: 'seven', name: 'Sjua' },
  { id: 'pentagon', name: 'Femhörning' },
  { id: 'octagon', name: 'Åttahörning' },
  { id: 'diamond', name: 'Romb' },
  { id: 'pillow', name: 'Kudde' },
  { id: 'cross', name: 'Kors' },
] as const;

export const BOT_COLORS = [
  { id: 'red', name: 'Röd' },
  { id: 'amber', name: 'Bärnsten' },
  { id: 'green', name: 'Grön' },
  { id: 'teal', name: 'Turkos' },
  { id: 'blue', name: 'Blå' },
  { id: 'violet', name: 'Lila' },
  { id: 'pink', name: 'Rosa' },
] as const;

export type BotShape = (typeof SHAPES)[number]['id'];
export type BotColor = (typeof BOT_COLORS)[number]['id'];
export type Expression = 'idle' | 'thinking' | 'working' | 'waiting' | 'done' | 'error';

export type Bot = { id: string; name: string; shape: BotShape; color: BotColor; createdAt: number; updatedAt: number };

// conversations: Hermes session id → bot id. A session whose bot was deleted stays
// mapped, which is what hides it from the app ("Botens samtal tas också bort från appen").
export type BotStore = { bots: Bot[]; conversations: Record<string, string> };
export const emptyStore: BotStore = { bots: [], conversations: {} };

export const NAME_MAX = 24;

const isShape = (v: unknown): v is BotShape => SHAPES.some((s) => s.id === v);
const isColor = (v: unknown): v is BotColor => BOT_COLORS.some((c) => c.id === v);

// Parses what AsyncStorage returned. Throws on anything that is not a bot store.
export function parseStore(raw: string | null): BotStore {
  if (raw === null) return emptyStore;
  const data: unknown = JSON.parse(raw);
  if (typeof data !== 'object' || data === null || !('bots' in data) || !('conversations' in data)) throw new Error('bad bot store');
  const { bots, conversations } = data;
  if (!Array.isArray(bots) || typeof conversations !== 'object' || conversations === null) throw new Error('bad bot store');
  return {
    bots: bots.map((b: unknown): Bot => {
      if (typeof b !== 'object' || b === null) throw new Error('bad bot');
      const { id, name, shape, color, createdAt, updatedAt } = b as Record<string, unknown>;
      if (typeof id !== 'string' || typeof name !== 'string' || !isShape(shape) || !isColor(color)) throw new Error('bad bot');
      if (typeof createdAt !== 'number' || typeof updatedAt !== 'number') throw new Error('bad bot');
      return { id, name, shape, color, createdAt, updatedAt };
    }),
    conversations: Object.fromEntries(Object.entries(conversations).filter(([, v]) => typeof v === 'string')),
  };
}

export type NameProblem = 'empty' | 'duplicate';

// create-bot.md › Validering: trimmed, required, unique case-insensitively (own name allowed when editing).
export function nameProblem(name: string, bots: Bot[], selfId?: string): NameProblem | null {
  const trimmed = name.trim();
  if (!trimmed) return 'empty';
  const lower = trimmed.toLocaleLowerCase('sv');
  return bots.some((b) => b.id !== selfId && b.name.toLocaleLowerCase('sv') === lower) ? 'duplicate' : null;
}

// Random among the 7, never the colour of the most recently created bot.
export function pickColor(bots: Bot[], random: number): BotColor {
  const last = [...bots].sort((a, b) => b.createdAt - a.createdAt)[0]?.color;
  const pool = BOT_COLORS.map((c) => c.id).filter((id) => id !== last);
  return pool[Math.min(pool.length - 1, Math.floor(random * pool.length))];
}

export function botOfSession(store: BotStore, sessionId: string): Bot | undefined {
  const botId = store.conversations[sessionId];
  return store.bots.find((b) => b.id === botId);
}

// Sessions shown in the app: everything except conversations of deleted bots.
export function visibleSessions(sessions: Session[], store: BotStore): Session[] {
  return sessions.filter((s) => !(s.id in store.conversations) || botOfSession(store, s.id));
}

export function latestSession(sessions: Session[], store: BotStore, botId: string): Session | undefined {
  return sessions.filter((s) => store.conversations[s.id] === botId).sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

// Newest activity first: latest conversation, or when the bot was created or edited.
export function sortBots(store: BotStore, sessions: Session[]): Bot[] {
  const activity = (b: Bot) => Math.max(b.updatedAt, latestSession(sessions, store, b.id)?.updatedAt ?? 0);
  return [...store.bots].sort((a, b) => activity(b) - activity(a));
}

export type BotStatus = 'waiting' | 'working' | 'thinking' | 'streaming' | 'error' | 'idle';

// chat.md › Uttryck i toppfältet. Priority on Bots: Väntar > Arbetar > Fel > övrigt.
export function botStatus(chat: ChatState | undefined): BotStatus {
  if (!chat) return 'idle';
  const { run, messages } = chat;
  if (run) {
    if (run.approvals.length) return 'waiting';
    if (run.steps.some((s) => s.state === 'active')) return 'working';
    return messages.at(-1)?.status === 'streaming' ? 'streaming' : 'thinking';
  }
  return messages.at(-1)?.status === 'error' ? 'error' : 'idle';
}

export const STATUS_TEXT: Record<BotStatus, string | null> = {
  waiting: 'Väntar på dig',
  working: 'Arbetar',
  thinking: 'Tänker',
  streaming: 'Svarar',
  error: 'Fel',
  idle: null,
};

export const STATUS_EXPRESSION: Record<BotStatus, Expression> = {
  waiting: 'waiting',
  working: 'working',
  thinking: 'thinking',
  streaming: 'thinking',
  error: 'error',
  idle: 'idle',
};
