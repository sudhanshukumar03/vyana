import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Paperclip, Square } from 'lucide-react';
import { apiJson, getSessionEpoch } from '../services/api';
import type { ChatResponse, ReportResponse } from '../../../../shared/types/health';
import { conversationHistory, readReport, type AssistantMessage } from '../lib/assistant';

const QUICK = [
  'What do my latest readings show?',
  'How am I doing today?',
  'Help me prepare questions for my clinician',
];

export default function Assistant() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Reports are reviewed once and are not saved for follow-up questions.');
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const active = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const busy = sending || uploading;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; active.current?.abort(); };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }, [messages, sending]);

  const run = async (kind: 'chat' | 'report', operation: (signal: AbortSignal) => Promise<AssistantMessage>) => {
    const controller = new AbortController();
    active.current = controller;
    const epoch = getSessionEpoch();
    const timer = window.setTimeout(() => controller.abort('timeout'), 45000);
    const current = () => alive.current && getSessionEpoch() === epoch && active.current === controller;
    if (kind === 'chat') setSending(true); else setUploading(true);
    setStatusMessage(kind === 'report' ? 'Reviewing report. This may take about 30 seconds. You can stop this request.' : 'Preparing your answer. This may take about 30 seconds. You can stop this request.');
    try {
      const message = await operation(controller.signal);
      if (current() && !controller.signal.aborted) {
        setMessages(previous => [...previous, message]);
        setStatusMessage(message.metadata?.offline ? 'Limited guidance ready. AI analysis is unavailable.' : kind === 'report'
          ? message.reviewed ? 'Report review ready.' : 'Report not reviewed. Check the file message.' : 'Response ready.');
      }
    } catch (error) {
      if (current()) {
        setStatusMessage(controller.signal.aborted ? controller.signal.reason === 'timeout' ? 'Request timed out. Please try again.' : 'Request stopped.' : 'Request failed. Please try again.');
        setMessages(previous => [...previous, {role: 'assistant', kind: 'error', content:
        controller.signal.aborted ? (controller.signal.reason === 'timeout' ? 'The request took too long. Please try again.' : 'Request stopped. You can send another message or choose the report again.') :
        error instanceof Error ? error.message : 'Could not reach the assistant. Please try again.'}]);
      }
    } finally {
      window.clearTimeout(timer);
      if (current()) {
        if (document.activeElement === document.body || document.activeElement === sendRef.current) inputRef.current?.focus();
        active.current = null; setSending(false); setUploading(false);
      }
    }
  };

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || msg.length > 4000 || active.current) return;
    setInput('');
    const history = conversationHistory(messages);
    setMessages((m) => [...m, { role: 'user', content: msg, kind: 'chat' }]);
    inputRef.current?.focus();
    await run('chat', async signal => {
      const data = await apiJson<ChatResponse>('/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ message: msg, history }), signal,
      });
      return {role: 'assistant', content: data.reply, kind: 'chat', metadata: data};
    });
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || active.current) return;
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.type)) {
      setStatusMessage('Upload not sent. Choose a PDF, PNG or JPG file.');
      setMessages((m) => [...m, { role: 'assistant', kind: 'error', content: 'Please upload a PDF, PNG, or JPG file.' }]);
      return;
    }
    if (!file.size || file.size > 10 * 1024 * 1024) {
      setStatusMessage('Upload not sent. Choose a nonempty report no larger than 10 MiB.');
      setMessages((m) => [...m, { role: 'assistant', kind: 'error', content: 'Choose a nonempty report no larger than 10 MiB.' }]);
      return;
    }
    setMessages((m) => [...m, { role: 'user', content: `Report selected: ${file.name}`, kind: 'report' }]);
    await run('report', async signal => {
      const b64 = await readReport(file, signal);
      const data = await apiJson<ReportResponse>('/assistant/report', {
        method: 'POST',
        body: JSON.stringify({ data_base64: b64, mime_type: file.type, filename: file.name }), signal,
      });
      const sections = [...data.sections];
      if (data.discussion_points.length) sections.push({title: 'Questions for your clinician', items: data.discussion_points});
      return {role: 'assistant', content: data.summary, kind: 'report', reviewed: data.document_status === 'readable', metadata: {...data, sections}};
    });
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-full">
      <div className="flex items-center gap-3 mb-1">
        <Sparkles className="w-7 h-7 text-brand" />
        <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
      </div>
      <p className="text-sm text-muted mb-4">Understand your readings and reports. Wellness guidance only; not a diagnosis or prescription.</p>

      <div role="log" tabIndex={0} aria-live="polite" aria-relevant="additions" aria-atomic="false" aria-label="Conversation" aria-busy={busy} className="flex-1 min-h-0 overflow-y-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-10">
            <p className="text-gray-500 text-sm mb-5">Ask about your vitals, activity, diet, or goals.</p>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {QUICK.map((q) => (
                <button key={q} type="button" onClick={() => send(q)} disabled={busy}
                  className="text-[13px] text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`min-w-0 max-w-full sm:max-w-[90%] [overflow-wrap:anywhere] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === 'user' ? 'bg-brand text-white' : 'bg-surface-soft text-ink'
              }`}>
                {m.role === 'assistant' && <p className="text-xs font-semibold text-muted mb-2">{m.kind === 'error' ? 'Request update' : m.metadata?.source === 'gemini' && !m.metadata.offline ? 'Gemini response' : m.metadata?.source === 'rules' ? 'Vyana guidance' : 'Limited guidance · AI unavailable'}</p>}
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.metadata?.sections.map((section, index) => <section key={index} className="mt-4">
                  <h2 className="text-sm font-semibold mb-1">{section.title}</h2>
                  <ul className="list-disc pl-5 space-y-1">{section.items.map((item, itemIndex) => <li key={itemIndex} className="whitespace-pre-wrap">{item}</li>)}</ul>
                </section>)}
                {m.metadata?.retry_after_seconds && <p className="mt-3 text-xs text-muted">Wait at least {m.metadata.retry_after_seconds} seconds before trying again.</p>}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <p role="status" aria-atomic="true" className="min-h-6 mt-2 text-sm text-muted">{statusMessage}</p>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-4 flex items-center gap-2">
        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="hidden" onChange={onFile} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} aria-label="Upload a health report (PDF or image)" className="shrink-0 p-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          ref={inputRef}
          maxLength={4000}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the assistant…"
          aria-label="Message the assistant"
          className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-gray-200 text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        />
        <button ref={sendRef} type={busy ? 'button' : 'submit'} disabled={!busy && !input.trim()} aria-label={busy ? 'Stop response' : 'Send message'}
          onClick={busy ? () => { active.current?.abort(); inputRef.current?.focus(); } : undefined}
          className="shrink-0 p-3 rounded-xl bg-brand text-white hover:bg-brand-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          {busy ? <Square className="w-5 h-5" /> : <Send className="w-5 h-5" />}
        </button>
      </form>
    </div>
  );
}
