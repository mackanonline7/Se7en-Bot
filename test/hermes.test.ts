import { hermes, HermesError, type StreamEvent } from '../src/hermes/client';
import { chatReducer, initialChat, type ChatState } from '../src/state/chat';
import { startMockHermes, TOKEN, type MockHermes } from './mockHermes';

let server: MockHermes;
const conn = () => ({ url: server.url, token: TOKEN });

beforeEach(async () => {
  server = await startMockHermes();
});
afterEach(() => server.close());

const frame = (event: string, payload: Record<string, unknown>): [string, Record<string, unknown>] => [
  event,
  { session_id: 'api_new', run_id: 'run_1', seq: 1, ts: 1, ...payload },
];

test('a wrong token is rejected as 401', async () => {
  await expect(hermes.verify({ url: server.url, token: 'wrong' })).rejects.toMatchObject({ status: 401, code: 'invalid_api_key' });
});

test('an unreachable server is reported as unreachable', async () => {
  const error = await hermes.verify({ url: 'http://127.0.0.1:1', token: TOKEN }).catch((e) => e);
  expect(error).toBeInstanceOf(HermesError);
  expect(error.code).toBe('unreachable');
});

test('sessions: only api_server sessions are listed, timestamps become ms', async () => {
  const sessions = await hermes.listSessions(conn());
  expect(server.received[0].path).toBe('/api/sessions?source=api_server&limit=200');
  expect(sessions).toEqual([
    { id: 'api_1', title: 'Resplan', preview: 'Planera resan', updatedAt: 1_700_000_100_250 },
    { id: 'api_2', title: null, preview: 'Hej', updatedAt: 1_700_000_000_000 },
  ]);
});

test('messages: tool rows, empty tool-call turns and hidden rows are dropped; text parts are joined', async () => {
  const messages = await hermes.messages(conn(), 'api_1');
  expect(messages).toEqual([
    { id: '1', role: 'user', text: 'Hej', createdAt: 1_700_000_000_000 },
    { id: '4', role: 'assistant', text: 'Hej! Vad vill du?', createdAt: 1_700_000_003_000 },
  ]);
});

test('a streamed turn drives the chat state from sending to a finished answer', async () => {
  server.streamFrames = [
    frame('run.started', { user_message: { role: 'user', content: 'Väder?' }, runtime: {} }),
    frame('message.started', { message: { id: 'msg_1', role: 'assistant' } }),
    frame('tool.started', { message_id: 'msg_1', tool_name: 'web_search', preview: 'väder Stockholm', args: {} }),
    frame('tool.progress', { message_id: 'msg_1', tool_name: '_thinking', delta: 'hmm' }),
    frame('tool.completed', { message_id: 'msg_1', tool_name: 'web_search', preview: null, args: {} }),
    frame('assistant.delta', { message_id: 'msg_1', delta: 'Sol ' }),
    frame('assistant.delta', { message_id: 'msg_1', delta: 'och 12°' }),
    frame('assistant.completed', { message_id: 'msg_1', content: 'Sol och 12°.', completed: true, runtime: { provider: 'openrouter', model: 'claude-x' } }),
    frame('run.completed', { message_id: 'msg_1', completed: true, messages: [], usage: {}, runtime: {} }),
    frame('done', {}),
  ];
  let state: ChatState = chatReducer(initialChat, { type: 'send', text: 'Väder?', userId: 'u', assistantId: 'a', at: 0 });
  const sessionId = await hermes.createSession(conn());
  state = chatReducer(state, { type: 'sessionCreated', sessionId });

  const seen: StreamEvent[] = [];
  const snapshots: ChatState[] = [];
  await hermes.chatStream(conn(), sessionId, 'Väder?', (event) => {
    seen.push(event);
    state = chatReducer(state, { type: 'stream', assistantId: 'a', event });
    snapshots.push(state);
  }, new AbortController().signal);

  expect(server.received.at(-1)).toMatchObject({ method: 'POST', path: '/api/sessions/api_new/chat/stream', body: { message: 'Väder?' } });
  expect(seen.map((e) => e.type)).toEqual(['started', 'tool', 'tool', 'delta', 'delta', 'completed', 'end']);
  // Mid-stream: the step is done and the partial answer is streaming.
  expect(snapshots[4].run?.steps).toEqual([{ name: 'web_search', label: 'väder Stockholm', state: 'done' }]);
  expect(snapshots[4].messages[1]).toMatchObject({ text: 'Sol och 12°', status: 'streaming' });
  expect(state.run).toBeNull();
  expect(state.sessionId).toBe('api_new');
  expect(state.runtime).toEqual({ provider: 'openrouter', model: 'claude-x' });
  expect(state.messages.map((m) => [m.role, m.text, m.status])).toEqual([
    ['user', 'Väder?', 'sent'],
    ['assistant', 'Sol och 12°.', 'sent'],
  ]);
});

test('a failed turn ends as an error bubble', async () => {
  server.streamFrames = [
    frame('run.started', { runtime: {} }),
    frame('assistant.completed', { content: '', completed: false }),
    frame('run.failed', { completed: false, turn_exit_reason: 'provider_error' }),
  ];
  let state = chatReducer(initialChat, { type: 'send', text: 'x', userId: 'u', assistantId: 'a', at: 0 });
  await hermes.chatStream(conn(), 'api_new', 'x', (event) => {
    state = chatReducer(state, { type: 'stream', assistantId: 'a', event });
  }, new AbortController().signal);
  expect(state.messages[1].status).toBe('error');
  expect(state.run).toBeNull();
});

test('approval: the event is surfaced and answered with its request_id (legacy gateway)', async () => {
  server.streamFrames = [
    frame('run.started', { runtime: {} }),
    frame('approval.request', {
      event: 'approval.request',
      command: 'rm -rf build/',
      description: 'Radera build-mappen',
      pattern_key: 'rm',
      request_id: 'req_9',
      choices: ['once', 'session', 'deny'],
    }),
  ];
  let state = chatReducer(initialChat, { type: 'send', text: 'städa', userId: 'u', assistantId: 'a', at: 0 });
  await hermes.chatStream(conn(), 'api_new', 'städa', (event) => {
    state = chatReducer(state, { type: 'stream', assistantId: 'a', event });
  }, new AbortController().signal);
  const approval = state.run!.approvals[0];
  expect(approval).toEqual({ requestId: 'req_9', command: 'rm -rf build/', description: 'Radera build-mappen', choices: ['once', 'session', 'deny'] });

  await hermes.respondApproval(conn(), 'run_1', approval, 'once');
  expect(server.received.at(-1)).toMatchObject({ path: '/v1/runs/run_1/approval', body: { request_id: 'req_9', choice: 'once' } });
  state = chatReducer(state, { type: 'approvalResolved', approval });
  expect(state.run!.approvals).toEqual([]);
});

test('approval: a canonical gateway gets the exact prompt identity from the run', async () => {
  server.run = { status: 'waiting_for_approval', execution_generation: 3, pending_controls: [{ kind: 'approval', prompt_id: 'p_7' }] };
  await hermes.respondApproval(conn(), 'run_1', { requestId: null, command: 'x', description: '', choices: [] }, 'deny');
  expect(server.received.at(-1)!.body).toEqual({ request_id: 'p_7', execution_generation: 3, choice: 'deny' });
});

test('agent info: scheduled jobs', async () => {
  expect(await hermes.jobs(conn())).toEqual([{ id: 'abc123def456', name: 'Morgonbrief', schedule: 'Varje dag 07:00', paused: false }]);
});
