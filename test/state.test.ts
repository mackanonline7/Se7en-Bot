import { createSseParser } from '../src/hermes/sse';
import { chatReducer, initialChat } from '../src/state/chat';
import { groupSessions, searchSessions, sessionTitle } from '../src/state/history';

test('sse: frames split at any point are reassembled; comments are skipped', () => {
  const feed = createSseParser();
  expect(feed(': keepalive\n\nevent: assistant.de')).toEqual([]);
  expect(feed('lta\ndata: {"delta":"a"}\r\n\r\nevent: done\ndata: {}\n\n')).toEqual([
    { event: 'assistant.delta', data: '{"delta":"a"}' },
    { event: 'done', data: '{}' },
  ]);
});

test('chat: a send that never started marks the user message failed and drops the placeholder', () => {
  let s = chatReducer(initialChat, { type: 'send', text: 'hej', userId: 'u', assistantId: 'a', at: 0 });
  s = chatReducer(s, { type: 'sendFailed', userId: 'u', assistantId: 'a' });
  expect(s.messages).toEqual([{ id: 'u', role: 'user', text: 'hej', createdAt: 0, status: 'failed' }]);
  expect(s.run).toBeNull();
});

test('chat: stopping before any text removes the empty answer; after text it is kept', () => {
  const start = chatReducer(initialChat, { type: 'send', text: 'hej', userId: 'u', assistantId: 'a', at: 0 });
  const cancelled = { type: 'stream', assistantId: 'a', event: { type: 'end', status: 'cancelled' } } as const;
  expect(chatReducer(start, cancelled).messages.map((m) => m.id)).toEqual(['u']);

  const partial = chatReducer(start, { type: 'stream', assistantId: 'a', event: { type: 'delta', text: 'Del' } });
  expect(chatReducer(partial, cancelled).messages[1]).toMatchObject({ text: 'Del', status: 'sent' });
});

test('chat: a late terminal event after the turn ended changes nothing', () => {
  let s = chatReducer(initialChat, { type: 'send', text: 'hej', userId: 'u', assistantId: 'a', at: 0 });
  s = chatReducer(s, { type: 'stream', assistantId: 'a', event: { type: 'delta', text: 'Svar' } });
  s = chatReducer(s, { type: 'stream', assistantId: 'a', event: { type: 'end', status: 'completed' } });
  const again = chatReducer(s, { type: 'stream', assistantId: 'a', event: { type: 'end', status: 'failed' } });
  expect(again).toBe(s);
});

test('chat: history loaded for a session the user already left is ignored', () => {
  const s = chatReducer(chatReducer(initialChat, { type: 'open', sessionId: 'one' }), { type: 'open', sessionId: 'two' });
  expect(chatReducer(s, { type: 'loaded', sessionId: 'one', messages: [{ id: '1', role: 'user', text: 'x', createdAt: 0 }] })).toBe(s);
});

test('history: grouped by day, newest first, empty groups dropped', () => {
  const now = new Date(2026, 10, 12, 15, 0).getTime();
  const at = (d: number, h: number) => new Date(2026, 10, d, h).getTime();
  const sessions = [
    { id: 'old', title: 'Gammal', preview: null, updatedAt: at(1, 9) },
    { id: 'today2', title: 'B', preview: null, updatedAt: at(12, 14) },
    { id: 'yday', title: 'Igår', preview: null, updatedAt: at(11, 23) },
    { id: 'today1', title: 'A', preview: null, updatedAt: at(12, 0) },
    { id: 'week', title: 'V', preview: null, updatedAt: at(7, 10) },
  ];
  expect(groupSessions(sessions, now).map((g) => [g.label, g.sessions.map((s) => s.id)])).toEqual([
    ['Idag', ['today2', 'today1']],
    ['Igår', ['yday']],
    ['Förra veckan', ['week']],
    ['Tidigare', ['old']],
  ]);
});

test('history: search matches title and preview, case-insensitive; untitled falls back to preview', () => {
  const sessions = [
    { id: '1', title: 'Resplan Rom', preview: null, updatedAt: 0 },
    { id: '2', title: null, preview: 'boka hotell', updatedAt: 0 },
  ];
  expect(searchSessions(sessions, 'rom').map((s) => s.id)).toEqual(['1']);
  expect(searchSessions(sessions, 'HOTELL').map((s) => s.id)).toEqual(['2']);
  expect(sessionTitle(sessions[1])).toBe('boka hotell');
});

test('chat: a new step marks the previous active step done; a late failure still lands on its step', () => {
  const tool = (state: 'started' | 'completed' | 'failed', name: string) =>
    ({ type: 'stream', assistantId: 'a', event: { type: 'tool', state, name, preview: '' } }) as const;
  let s = chatReducer(initialChat, { type: 'send', text: 'hej', userId: 'u', assistantId: 'a', at: 0 });
  s = chatReducer(s, tool('started', 'web_search'));
  s = chatReducer(s, tool('started', 'write_file'));
  expect(s.run?.steps.map((x) => [x.name, x.state])).toEqual([['web_search', 'done'], ['write_file', 'active']]);
  s = chatReducer(s, tool('failed', 'web_search'));
  expect(s.run?.steps.map((x) => x.state)).toEqual(['failed', 'active']);
});
