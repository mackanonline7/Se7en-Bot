// A stand-in for the Hermes API server, speaking the wire format of
// gateway/platforms/api_server.py (_sse_frame, _SessionEventQueue, _session_response).
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export const TOKEN = 'test-key-0123456789abcdef';

export type Frame = [event: string, payload: Record<string, unknown>];
export type Received = { method: string; path: string; body: unknown };

export type MockHermes = {
  url: string;
  received: Received[];
  streamFrames: Frame[];
  run: Record<string, unknown>;
  close(): Promise<void>;
};

const sse = (event: string, payload: Record<string, unknown>) => `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

async function readBody(req: IncomingMessage): Promise<unknown> {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : null;
}

export async function startMockHermes(): Promise<MockHermes> {
  const state: Omit<MockHermes, 'url' | 'close'> = { received: [], streamFrames: [], run: { status: 'running' } };
  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const body = await readBody(req);
    state.received.push({ method: req.method ?? '', path: url.pathname + url.search, body });
    const json = (status: number, data: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    if (req.headers.authorization !== `Bearer ${TOKEN}`) {
      return json(401, { error: { message: 'Invalid API key', type: 'invalid_request_error', code: 'invalid_api_key' } });
    }
    const route = `${req.method} ${url.pathname}`;
    if (route === 'GET /api/sessions') {
      return json(200, {
        object: 'list',
        data: [
          { id: 'api_1', source: 'api_server', title: 'Resplan', started_at: 1_700_000_000.5, last_active: 1_700_000_100.25, preview: 'Planera resan' },
          { id: 'api_2', source: 'api_server', title: null, started_at: 1_700_000_000, preview: 'Hej' },
        ],
        limit: 200,
        offset: 0,
        has_more: false,
      });
    }
    if (route === 'POST /api/sessions') return json(201, { object: 'hermes.session', session: { id: 'api_new' } });
    if (route === 'GET /api/sessions/api_1/messages') {
      return json(200, {
        object: 'list',
        session_id: 'api_1',
        data: [
          { id: 1, role: 'user', content: 'Hej', timestamp: 1_700_000_000 },
          { id: 2, role: 'assistant', content: '', tool_calls: [{ id: 't1' }], timestamp: 1_700_000_001 },
          { id: 3, role: 'tool', content: '{"ok":true}', tool_name: 'web_search', timestamp: 1_700_000_002 },
          { id: 4, role: 'assistant', content: [{ type: 'text', text: 'Hej! ' }, { type: 'text', text: 'Vad vill du?' }], timestamp: 1_700_000_003 },
          { id: 5, role: 'user', content: '', display_kind: 'hidden', timestamp: 1_700_000_004 },
        ],
      });
    }
    if (route === 'POST /api/sessions/api_new/chat/stream') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(': keepalive\n\n');
      for (const [event, payload] of state.streamFrames) {
        // Split frames across writes to exercise the incremental parser.
        const text = sse(event, payload);
        res.write(text.slice(0, 7));
        res.write(text.slice(7));
      }
      return res.end();
    }
    if (route === 'GET /v1/runs/run_1') return json(200, state.run);
    if (route === 'POST /v1/runs/run_1/approval') return json(200, { object: 'hermes.run.approval_response', run_id: 'run_1' });
    if (route === 'POST /v1/runs/run_1/stop') return json(200, { status: 'stopping' });
    if (route === 'GET /api/jobs') {
      return json(200, { jobs: [{ id: 'abc123def456', name: 'Morgonbrief', schedule_display: 'Varje dag 07:00', state: 'scheduled' }] });
    }
    if (route === 'GET /v1/toolsets') {
      return json(200, {
        object: 'list',
        data: [
          { name: 'web', label: 'Webb', enabled: true, tools: ['web_search'] },
          { name: 'image_gen', label: 'Bilder', enabled: false, tools: [] },
        ],
      });
    }
    json(404, { error: { message: 'not found' } });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return Object.assign(state, {
    url: `127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  });
}
