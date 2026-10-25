import type { AiResponseMetadata } from '../../../../shared/types/health';

export type AssistantMessage = { role: 'user' | 'assistant'; content: string; kind: 'chat' | 'report' | 'error';
  metadata?: AiResponseMetadata };

export function conversationHistory(messages: AssistantMessage[]) {
  const result: {role: 'user' | 'assistant'; content: string}[] = [];
  for (const message of [...messages].reverse()) {
    if (message.kind !== 'chat' || message.metadata?.offline) continue;
    const sections = message.metadata?.sections.map(section => `${section.title}\n${section.items.join('\n')}`).join('\n\n');
    const turn = {role: message.role, content: [message.content, sections].filter(Boolean).join('\n\n').slice(0, 8000)};
    // Budget JSON bytes, not characters: Unicode history must fit the 100 KiB API boundary.
    if (new TextEncoder().encode(JSON.stringify([turn, ...result])).length > 60000) break;
    result.unshift(turn);
    if (result.length >= 8) break;
  }
  return result;
}

export function readReport(file: File, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => { reader.abort(); reject(new DOMException('Cancelled', 'AbortError')); };
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, {once: true});
    const cleanup = () => signal.removeEventListener('abort', abort);
    reader.onload = () => { cleanup(); resolve(String(reader.result).split(',')[1] || ''); };
    reader.onerror = () => { cleanup(); reject(new Error('Could not read that file. Please choose it again.')); };
    reader.onabort = cleanup;
    reader.readAsDataURL(file);
  });
}
