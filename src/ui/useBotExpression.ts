import { useEffect, useRef, useState } from 'react';
import { botStatus, STATUS_EXPRESSION, type Expression } from '../state/bots';
import type { ChatState } from '../state/chat';

// The avatar's expression follows the run; "Klar" shows for 1.5 s after a turn finished well.
export function useBotExpression(chat: ChatState | undefined): Expression {
  const status = botStatus(chat);
  const running = !!chat?.run;
  const wasRunning = useRef(running);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const finished = wasRunning.current && !running && status === 'idle';
    wasRunning.current = running;
    if (!finished) return;
    setDone(true);
    const timer = setTimeout(() => setDone(false), 1500);
    return () => clearTimeout(timer);
  }, [running, status]);
  return done && status === 'idle' ? 'done' : STATUS_EXPRESSION[status];
}
