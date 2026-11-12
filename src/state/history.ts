import type { Session } from '../hermes/client';

export type HistoryGroup = { label: 'Idag' | 'Igår' | 'Förra veckan' | 'Tidigare'; sessions: Session[] };

const DAY = 86_400_000;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function sessionTitle(s: Session): string {
  return s.title?.trim() || s.preview?.trim() || 'Nytt samtal';
}

// history.md: "Idag", "Igår", "Förra veckan", "Tidigare"; newest first; empty groups dropped.
export function groupSessions(sessions: Session[], now: number): HistoryGroup[] {
  const today = startOfDay(now);
  const groups: HistoryGroup[] = [
    { label: 'Idag', sessions: [] },
    { label: 'Igår', sessions: [] },
    { label: 'Förra veckan', sessions: [] },
    { label: 'Tidigare', sessions: [] },
  ];
  for (const s of [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)) {
    const i = s.updatedAt >= today ? 0 : s.updatedAt >= today - DAY ? 1 : s.updatedAt >= today - 7 * DAY ? 2 : 3;
    groups[i].sessions.push(s);
  }
  return groups.filter((g) => g.sessions.length);
}

export function searchSessions(sessions: Session[], query: string): Session[] {
  const q = query.trim().toLowerCase();
  return sessions.filter((s) => `${s.title ?? ''} ${s.preview ?? ''}`.toLowerCase().includes(q));
}

export const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

// Chat date divider, e.g. "Idag 08:12".
export function dayLabel(ms: number, now: number): string {
  const day = startOfDay(ms);
  const today = startOfDay(now);
  const prefix =
    day === today
      ? 'Idag'
      : day === today - DAY
        ? 'Igår'
        : new Date(ms).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${prefix} ${clock(ms)}`;
}
