import {
  botOfSession,
  botStatus,
  latestSession,
  nameProblem,
  parseStore,
  pickColor,
  sortBots,
  visibleSessions,
  type Bot,
  type BotStore,
} from '../src/state/bots';
import { chatReducer, initialChat } from '../src/state/chat';
import { highlight, searchSessions } from '../src/state/history';

const bot = (id: string, name: string, at = 0, color: Bot['color'] = 'red'): Bot => ({ id, name, shape: 'circle', color, createdAt: at, updatedAt: at });
const session = (id: string, updatedAt: number, title = id) => ({ id, title, preview: null, updatedAt });

test('store: a saved store round-trips; nothing saved is an empty store; damaged data is refused', () => {
  const store: BotStore = { bots: [bot('a', 'Kodaren', 5, 'teal')], conversations: { s1: 'a' } };
  expect(parseStore(JSON.stringify(store))).toEqual(store);
  expect(parseStore(null)).toEqual({ bots: [], conversations: {} });
  expect(() => parseStore('{"bots":[{"id":"a","name":"X","shape":"star","color":"red","createdAt":1,"updatedAt":1}],"conversations":{}}')).toThrow();
  expect(() => parseStore('[]')).toThrow();
});

test('name: trimmed, required, unique without regard to case; a bot may keep its own name', () => {
  const bots = [bot('a', 'Mejlhjälpen'), bot('b', 'Kodaren')];
  expect(nameProblem('   ', bots)).toBe('empty');
  expect(nameProblem(' MEJLHJÄLPEN ', bots)).toBe('duplicate');
  expect(nameProblem('Mejlhjälpen', bots, 'a')).toBeNull();
  expect(nameProblem('Kodaren', bots, 'a')).toBe('duplicate');
  expect(nameProblem('Ny bot 🙂', bots)).toBeNull();
});

test('colour: never the colour of the most recently created bot', () => {
  const bots = [bot('old', 'A', 1, 'blue'), bot('new', 'B', 2, 'red')];
  const picks = [0, 0.2, 0.4, 0.6, 0.8, 0.999].map((r) => pickColor(bots, r));
  expect(picks).toEqual(['amber', 'green', 'teal', 'blue', 'violet', 'pink']);
  expect(pickColor([], 0)).toBe('red');
});

test('conversations: a deleted bot hides its conversations; unlinked ones stay; latest per bot', () => {
  const store: BotStore = { bots: [bot('a', 'Kodaren')], conversations: { s1: 'a', s2: 'a', s3: 'deleted' } };
  const sessions = [session('s1', 10), session('s2', 30), session('s3', 40), session('old', 5)];
  expect(visibleSessions(sessions, store).map((s) => s.id)).toEqual(['s1', 's2', 'old']);
  expect(latestSession(sessions, store, 'a')?.id).toBe('s2');
  expect(latestSession(sessions, store, 'nobody')).toBeUndefined();
  expect(botOfSession(store, 's3')).toBeUndefined();
});

test('bots are sorted by latest activity: a conversation or the bot itself, newest first', () => {
  const store: BotStore = { bots: [bot('a', 'A', 10), bot('b', 'B', 20), bot('c', 'C', 5)], conversations: { s1: 'c' } };
  expect(sortBots(store, [session('s1', 50)]).map((b) => b.id)).toEqual(['c', 'b', 'a']);
});

test('status follows the run: thinking → working → streaming → waiting, then error or idle', () => {
  const stream = (event: Parameters<typeof chatReducer>[1] extends infer A ? (A extends { type: 'stream'; event: infer E } ? E : never) : never) =>
    ({ type: 'stream', assistantId: 'a', event }) as const;
  let s = chatReducer(initialChat, { type: 'send', text: 'hej', userId: 'u', assistantId: 'a', at: 0 });
  expect(botStatus(undefined)).toBe('idle');
  expect(botStatus(s)).toBe('thinking');
  s = chatReducer(s, stream({ type: 'tool', state: 'started', name: 'web', preview: '' }));
  expect(botStatus(s)).toBe('working');
  s = chatReducer(s, stream({ type: 'tool', state: 'completed', name: 'web', preview: '' }));
  s = chatReducer(s, stream({ type: 'delta', text: 'Svar' }));
  expect(botStatus(s)).toBe('streaming');
  s = chatReducer(s, stream({ type: 'approval', approval: { requestId: 'r', command: 'x', description: '', choices: [] } }));
  expect(botStatus(s)).toBe('waiting');
  expect(botStatus(chatReducer(s, stream({ type: 'end', status: 'failed' })))).toBe('error');
  expect(botStatus(chatReducer(s, stream({ type: 'end', status: 'completed' })))).toBe('idle');
});

test('history search also matches the bot name, and hits are marked for bold', () => {
  const sessions = [session('s1', 0, 'Fixa bygget'), session('s2', 0, 'Resplan')];
  const names: Record<string, string> = { s1: 'Kodaren' };
  expect(searchSessions(sessions, 'kodar', (id) => names[id]).map((s) => s.id)).toEqual(['s1']);
  expect(highlight('Resplan till Rom, resa i maj', 'res')).toEqual([
    { text: 'Res', match: true },
    { text: 'plan till Rom, ', match: false },
    { text: 'res', match: true },
    { text: 'a i maj', match: false },
  ]);
  expect(highlight('Hej', '')).toEqual([{ text: 'Hej', match: false }]);
});
