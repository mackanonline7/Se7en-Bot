// Hermes Agent API server client. Shapes follow gateway/platforms/api_server*.py
// (NousResearch/hermes-agent) and its docs (user-guide/features/api-server.md).
import { createSseParser } from './sse';

export type Connection = { url: string; token: string };

export class HermesError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message);
  }
}

export type Session = {
  id: string;
  title: string | null;
  preview: string | null;
  updatedAt: number; // ms
};

export type HistoryMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number; // ms
};

export type Approval = {
  requestId: string | null;
  command: string;
  description: string;
  choices: string[];
};

export type StreamEvent =
  | { type: 'started'; runId: string; runtime: Runtime }
  | { type: 'delta'; text: string }
  | { type: 'tool'; state: 'started' | 'completed' | 'failed'; name: string; preview: string }
  | { type: 'approval'; approval: Approval }
  | { type: 'completed'; text: string; runtime: Runtime }
  | { type: 'end'; status: 'completed' | 'failed' | 'cancelled' | 'queued'; reason?: string }
  | { type: 'error'; message: string };

export type Runtime = { provider?: string; model?: string };

export type Job = { id: string; name: string; schedule: string; paused: boolean };

export function normalizeUrl(raw: string): string {
  const url = raw.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(url) ? url : `http://${url}`;
}

const secondsToMs = (v: unknown) => (typeof v === 'number' ? v * 1000 : Date.now());

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === 'object' && 'text' in part ? String(part.text) : ''))
      .join('');
  }
  return '';
}

async function request<T>(conn: Connection, path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(normalizeUrl(conn.url) + path, {
      ...init,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${conn.token}`, 'Content-Type': 'application/json' },
    });
  } catch {
    throw new HermesError('Kunde inte nå servern', undefined, 'unreachable');
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body?.error;
    const message = typeof err === 'string' ? err : err?.message ?? `HTTP ${res.status}`;
    throw new HermesError(message, res.status, typeof err === 'object' ? err?.code : undefined);
  }
  return body as T;
}

export const hermes = {
  // Any authenticated route proves both reachability and the token.
  async verify(conn: Connection): Promise<void> {
    await request(conn, '/api/sessions?limit=1');
  },

  // Only sessions this API owns: Hermes refuses turns on CLI/Telegram/Desktop sessions (409).
  async listSessions(conn: Connection): Promise<Session[]> {
    const body = await request<{ data: any[] }>(conn, '/api/sessions?source=api_server&limit=200');
    return body.data.map((s) => ({
      id: String(s.id),
      title: s.title ?? null,
      preview: s.preview ?? null,
      updatedAt: secondsToMs(s.last_active ?? s.started_at),
    }));
  },

  async createSession(conn: Connection): Promise<string> {
    const body = await request<{ session: { id: string } }>(conn, '/api/sessions', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return body.session.id;
  },

  async renameSession(conn: Connection, id: string, title: string): Promise<void> {
    await request(conn, `/api/sessions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
  },

  async deleteSession(conn: Connection, id: string): Promise<void> {
    await request(conn, `/api/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async messages(conn: Connection, id: string): Promise<HistoryMessage[]> {
    const body = await request<{ data: any[] }>(conn, `/api/sessions/${encodeURIComponent(id)}/messages?inline_images=false`);
    return body.data
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.display_kind !== 'hidden')
      .map((m) => ({ id: String(m.id), role: m.role, text: textOf(m.content), createdAt: secondsToMs(m.timestamp) }))
      .filter((m) => m.text.trim() !== '');
  },

  // One agent turn over SSE. Resolves when the stream ends.
  async chatStream(
    conn: Connection,
    sessionId: string,
    input: string,
    onEvent: (e: StreamEvent) => void,
    signal: AbortSignal,
  ): Promise<void> {
    let res: Response;
    try {
      res = await fetch(normalizeUrl(conn.url) + `/api/sessions/${encodeURIComponent(sessionId)}/chat/stream`, {
        method: 'POST',
        signal,
        headers: {
          Authorization: `Bearer ${conn.token}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ message: input }),
      });
    } catch (e) {
      if (signal.aborted) return;
      throw new HermesError('Kunde inte nå servern', undefined, 'unreachable');
    }
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      throw new HermesError(body?.error?.message ?? `HTTP ${res.status}`, res.status, body?.error?.code);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const feed = createSseParser();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const frame of feed(decoder.decode(value, { stream: true }))) {
          const event = toStreamEvent(frame.event, JSON.parse(frame.data));
          if (event) onEvent(event);
        }
      }
    } catch (e) {
      if (!signal.aborted) throw e;
    }
  },

  async stopRun(conn: Connection, runId: string): Promise<void> {
    await request(conn, `/v1/runs/${encodeURIComponent(runId)}/stop`, { method: 'POST', body: '{}' });
  },

  // Canonical gateways want the exact prompt identity from GET /v1/runs/{id};
  // legacy ones accept the request_id from the approval.request event.
  async respondApproval(conn: Connection, runId: string, approval: Approval, choice: 'once' | 'deny'): Promise<void> {
    const run = await request<{ pending_controls?: any[]; execution_generation?: number }>(
      conn,
      `/v1/runs/${encodeURIComponent(runId)}`,
    );
    const prompt = run.pending_controls?.find((p) => p.kind === 'approval');
    const body = prompt
      ? { request_id: prompt.prompt_id, execution_generation: run.execution_generation, choice }
      : approval.requestId
        ? { request_id: approval.requestId, choice }
        : { choice };
    await request(conn, `/v1/runs/${encodeURIComponent(runId)}/approval`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async jobs(conn: Connection): Promise<Job[]> {
    const body = await request<{ jobs: any[] }>(conn, '/api/jobs');
    return body.jobs.map((j) => ({
      id: String(j.id),
      name: String(j.name ?? j.id),
      schedule: String(j.schedule_display ?? ''),
      paused: j.state === 'paused',
    }));
  },

  async toolsets(conn: Connection): Promise<string[]> {
    const body = await request<{ data: any[] }>(conn, '/v1/toolsets');
    return body.data.filter((t) => t.enabled).map((t) => String(t.label || t.name));
  },
};

export function toStreamEvent(name: string, p: any): StreamEvent | null {
  switch (name) {
    case 'run.started':
      return { type: 'started', runId: p.run_id, runtime: p.runtime ?? {} };
    case 'assistant.delta':
      return { type: 'delta', text: p.delta ?? '' };
    case 'tool.started':
    case 'tool.completed':
    case 'tool.failed':
      if (!p.tool_name || p.tool_name.startsWith('_')) return null;
      return {
        type: 'tool',
        state: name.slice(5) as 'started' | 'completed' | 'failed',
        name: p.tool_name,
        preview: p.preview ?? '',
      };
    case 'approval.request':
      return {
        type: 'approval',
        approval: {
          requestId: p.request_id ?? p.prompt_id ?? null,
          command: p.command ?? '',
          description: p.description ?? '',
          choices: p.choices ?? ['once', 'deny'],
        },
      };
    case 'assistant.completed':
      return { type: 'completed', text: p.content ?? '', runtime: p.runtime ?? {} };
    case 'run.completed':
    case 'run.failed':
    case 'run.cancelled':
    case 'run.queued':
      return { type: 'end', status: name.slice(4) as 'completed', reason: p.turn_exit_reason };
    case 'error':
      return { type: 'error', message: p.message ?? 'Okänt fel' };
    default:
      return null;
  }
}
