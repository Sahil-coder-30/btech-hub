/**
 * Reads a newline delimited JSON stream. A network chunk can end in the middle
 * of a line (or a multi-byte character), so text is buffered until a newline.
 * Lines that are not valid JSON are skipped instead of breaking the stream.
 */
export async function* readNdjson<T>(body: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const parse = (line: string): T | undefined => {
    const text = line.trim();
    if (!text) return undefined;
    try {
      return JSON.parse(text) as T;
    } catch {
      return undefined;
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const event = parse(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        if (event !== undefined) yield event;
        newline = buffer.indexOf("\n");
      }
    }
    buffer += decoder.decode();
    const last = parse(buffer);
    if (last !== undefined) yield last;
  } finally {
    reader.releaseLock();
  }
}
