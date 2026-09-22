import { createParser } from 'eventsource-parser';
import { flushSync } from 'react-dom';

type Payload = {
  type?: string;
  b64_json?: string;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
  error?: { message?: string };
};

export async function streamImage(
  endpoint: string,
  input: Record<string, unknown>,
  headers: HeadersInit,
  onFrame: (dataUrl: string, final: boolean) => void,
) {
  const send = (stream: boolean) => fetch(endpoint, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, stream }),
  });

  const response = await send(true);
  if (!response.ok || !response.body) {
    const detail = await response.json().catch(() => ({ error: 'Não foi possível gerar a imagem.' }));
    throw new Error(detail.error ?? 'Não foi possível gerar a imagem.');
  }

  let completed = false;
  let sawEvent = false;
  let failure = '';
  let usage: Payload['usage'];
  const parser = createParser({
    onEvent(event) {
      let payload: Payload | undefined;
      try { payload = JSON.parse(event.data) as Payload; } catch { return; }
      if (event.event === 'error' || payload.type === 'error') {
        sawEvent = true;
        failure = payload.error?.message ?? 'A geração da imagem foi bloqueada.';
        return;
      }
      const type = event.event || payload.type;
      if (type !== 'image_generation.partial_image' && type !== 'image_generation.completed') return;
      sawEvent = true;
      if (!payload.b64_json) {
        failure = 'A IA não devolveu uma imagem.';
        return;
      }
      const final = type === 'image_generation.completed';
      flushSync(() => onFrame(`data:image/png;base64,${payload.b64_json}`, final));
      if (final) {
        completed = true;
        usage = payload.usage;
      }
    },
  });

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      let chunk: ReadableStreamReadResult<string>;
      try { chunk = await reader.read(); } catch (error) {
        if (sawEvent) throw error;
        break;
      }
      if (chunk.done) break;
      parser.feed(chunk.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  if (failure) throw new Error(failure);
  if (!sawEvent) {
    const replay = await send(false);
    const body = await replay.json().catch(() => ({}));
    if (!replay.ok) throw new Error(body.error ?? 'Não foi possível gerar a imagem.');
    const b64 = body.data?.[0]?.b64_json;
    if (!b64) throw new Error('A IA não devolveu uma imagem.');
    onFrame(`data:image/png;base64,${b64}`, true);
    return body.usage;
  }
  if (!completed) throw new Error('A geração terminou antes de concluir a imagem.');
  return usage;
}