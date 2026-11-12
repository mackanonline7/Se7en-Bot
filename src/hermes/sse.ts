export type SseFrame = { event: string; data: string };

// Incremental Server-Sent Events parser: feed decoded text, get complete frames.
export function createSseParser() {
  let buffer = '';
  return function feed(text: string): SseFrame[] {
    buffer += text.replace(/\r\n?/g, '\n');
    const frames: SseFrame[] = [];
    let end: number;
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = 'message';
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith(':')) continue;
        const colon = line.indexOf(':');
        const field = colon === -1 ? line : line.slice(0, colon);
        const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
        if (field === 'event') event = value;
        else if (field === 'data') data.push(value);
      }
      if (data.length) frames.push({ event, data: data.join('\n') });
    }
    return frames;
  };
}
