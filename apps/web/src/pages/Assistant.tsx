import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Paperclip, Square, Sparkles, AlertCircle, Shield } from 'lucide-react';
import { apiJson, getSessionEpoch } from '../services/api';
import type { ChatResponse, ReportResponse } from '../../../../shared/types/health';
import { conversationHistory, readReport, type AssistantMessage } from '../lib/assistant';
import { AiRobotIcon } from '../components/AiRobotIcon';
import { useHealthStore } from '../store/useHealthStore';

const QUICK = [
  'What do my latest readings show?',
  'How am I doing today?',
  'Help me prepare questions for my clinician',
  'Are my heart rate and SpO2 in healthy ranges?',
];

interface IncomingReportState {
  id: string;
  owner: number;
}

export default function Assistant() {
  const owner = useHealthStore((state) => state.user?.id);
  return <OwnedAssistant key={owner} owner={owner} />;
}

function OwnedAssistant({ owner }: { owner: number | undefined }) {
  const location = useLocation();
  const incomingReport = location.state?.report as IncomingReportState | undefined;
  const processedIncomingRef = useRef(false);

  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    'Report reviews are separate from chat. Follow-up chat does not include your report.'
  );
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const active = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const busy = sending || uploading;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      active.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      endRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    }
  }, [messages, sending]);

  const run = async (kind: 'chat' | 'report', operation: (signal: AbortSignal) => Promise<AssistantMessage>) => {
    const controller = new AbortController();
    active.current = controller;
    const epoch = getSessionEpoch();
    const timer = window.setTimeout(() => controller.abort('timeout'), 45000);
    const current = () => alive.current && getSessionEpoch() === epoch && active.current === controller;
    if (kind === 'chat') setSending(true);
    else setUploading(true);
    setStatusMessage(
      kind === 'report'
        ? 'Reviewing report. This may take about 30 seconds. You can stop this request.'
        : 'Preparing your answer. This may take about 30 seconds. You can stop this request.'
    );
    try {
      const message = await operation(controller.signal);
      if (current() && !controller.signal.aborted) {
        setMessages((previous) => [...previous, message]);
        setStatusMessage(
          message.metadata?.offline
            ? 'Limited guidance ready. AI analysis is unavailable.'
            : kind === 'report'
            ? message.reviewed
              ? 'Report review ready. Follow-up chat does not include this report.'
              : 'Report not reviewed. Check the file message.'
            : 'Response ready.'
        );
      }
    } catch (error) {
      if (current()) {
        setStatusMessage(
          controller.signal.aborted
            ? controller.signal.reason === 'timeout'
              ? 'Request timed out. Please try again.'
              : 'Request stopped.'
            : 'Request failed. Please try again.'
        );
        setMessages((previous) => [
          ...previous,
          {
            role: 'assistant',
            kind: 'error',
            content: controller.signal.aborted
              ? controller.signal.reason === 'timeout'
                ? 'The request took too long. Please try again.'
                : 'Request stopped. You can send another message or choose the report again.'
              : error instanceof Error
              ? error.message
              : 'Could not reach the assistant. Please try again.',
          },
        ]);
      }
    } finally {
      window.clearTimeout(timer);
      if (current()) {
        if (document.activeElement === document.body || document.activeElement === sendRef.current) {
          inputRef.current?.focus();
        }
        active.current = null;
        setSending(false);
        setUploading(false);
      }
    }
  };

  useEffect(() => {
    if (!incomingReport || processedIncomingRef.current) return;
    processedIncomingRef.current = true;
    window.history.replaceState({ ...window.history.state, usr: null }, document.title);
    if (incomingReport.owner !== owner) {
      setStatusMessage('This report belongs to a different session. Open it from your report library.');
      return;
    }
    void run('report', async (signal) => {
      const saved = await apiJson<{ filename: string; analysis: ReportResponse; status: string }>(
        `/reports/${incomingReport.id}`,
        { signal }
      );
      if (!saved.analysis) throw Error('No saved report review is available.');
      const data = saved.analysis;
      const sections = [...data.sections];
      if (data.discussion_points.length) {
        sections.push({ title: 'Questions for your clinician', items: data.discussion_points });
      }
      return {
        role: 'assistant',
        kind: 'report',
        content: data.summary,
        reviewed: saved.status === 'reviewed',
        metadata: { ...data, sections },
      };
    });
  }, [incomingReport, owner]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || msg.length > 4000 || active.current) return;
    setInput('');
    const history = conversationHistory(messages);
    setMessages((m) => [...m, { role: 'user', content: msg, kind: 'chat' }]);
    inputRef.current?.focus();
    await run('chat', async (signal) => {
      const data = await apiJson<ChatResponse>('/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ message: msg, history }),
        signal,
      });
      return { role: 'assistant', content: data.reply, kind: 'chat', metadata: data };
    });
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || active.current) return;
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.type)) {
      setStatusMessage('Upload not sent. Choose a PDF, PNG or JPG file.');
      setMessages((m) => [
        ...m,
        { role: 'assistant', kind: 'error', content: 'Please upload a PDF, PNG, or JPG file.' },
      ]);
      return;
    }
    if (!file.size || file.size > 10 * 1024 * 1024) {
      setStatusMessage('Upload not sent. Choose a nonempty report no larger than 10 MiB.');
      setMessages((m) => [
        ...m,
        { role: 'assistant', kind: 'error', content: 'Choose a nonempty report no larger than 10 MiB.' },
      ]);
      return;
    }
    setMessages((m) => [...m, { role: 'user', content: `Report selected: ${file.name}`, kind: 'report' }]);
    await run('report', async (signal) => {
      const b64 = await readReport(file, signal);
      const data = await apiJson<ReportResponse>('/assistant/report', {
        method: 'POST',
        body: JSON.stringify({ data_base64: b64, mime_type: file.type, filename: file.name }),
        signal,
      });
      const sections = [...data.sections];
      if (data.discussion_points.length) {
        sections.push({ title: 'Questions for your clinician', items: data.discussion_points });
      }
      return {
        role: 'assistant',
        content: data.summary,
        kind: 'report',
        reviewed: data.source === 'gemini' && !data.offline && data.document_status === 'readable',
        metadata: { ...data, sections },
      };
    });
  };

  return (
    <div className="page-stack assistant-page max-w-5xl mx-auto w-full flex flex-col flex-1 h-[calc(100dvh-110px)] min-h-[620px]">
      <h1 className="sr-only">AI Assistant</h1>

      {/* Unified Executive Assistant Frame */}
      <div className="surface rounded-3xl border border-line bg-surface shadow-xs flex flex-col flex-1 min-h-0 overflow-hidden">
        {messages.length > 0 && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-line bg-surface-soft/60 shrink-0">
            <div className="flex items-center gap-2">
              <AiRobotIcon size={18} className="text-brand" />
              <span className="text-xs font-semibold text-ink font-display">AI Assistant</span>
            </div>
            <button
              type="button"
              onClick={() => setMessages([])}
              className="text-xs font-semibold text-muted hover:text-ink px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-surface-soft transition-colors shadow-2xs"
            >
              Clear chat
            </button>
          </div>
        )}
        {/* Scrollable Conversation Output Screen */}
        <div
          role="log"
          tabIndex={0}
          aria-live="polite"
          aria-relevant="additions"
          aria-atomic="false"
          aria-label="Conversation with Vyana AI Assistant"
          aria-busy={busy}
          className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 focus-visible:outline-none"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-6 px-4 text-center max-w-lg mx-auto">
              {/* Robot Avatar Welcome Badge */}
              <div className="relative inline-flex items-center justify-center mb-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#2E62DE]/15 via-[#2E62DE]/5 to-transparent border border-brand/20 flex items-center justify-center text-brand shadow-md">
                  <AiRobotIcon size={38} className="text-brand" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white" />
                </span>
              </div>

              <h2 className="text-xl font-bold text-ink tracking-tight mb-1 font-display">
                How can I assist your health today?
              </h2>
              <p className="text-xs text-muted leading-relaxed mb-5 max-w-md">
                I can analyze your continuous ESP32 vitals, review laboratory reports, track trends, and help prepare questions for your physician.
              </p>

              {/* Quick Prompt Pill Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    disabled={busy}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-surface-soft/80 hover:bg-brand/10 hover:text-brand border border-line hover:border-brand/30 text-body transition-all shadow-2xs text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand min-h-[44px]"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-brand shrink-0" aria-hidden="true" />
                    <span className="truncate">{q}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} transition-opacity`}
              >
                {/* Message Bubble */}
                <div
                  className={`min-w-0 max-w-full sm:max-w-[85%] [overflow-wrap:anywhere] rounded-2xl p-4 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-brand text-white shadow-sm rounded-tr-none'
                      : 'bg-surface-soft border border-line text-ink rounded-tl-none shadow-2xs'
                  }`}
                >
                  {/* Assistant Role Indicator */}
                  {m.role === 'assistant' && (
                    <div className="text-xs font-semibold text-muted mb-2.5 flex items-center gap-2 border-b border-line/60 pb-1.5">
                      <span className="w-6 h-6 rounded-lg bg-brand/10 border border-brand/20 grid place-content-center text-brand shrink-0">
                        <AiRobotIcon size={14} className="text-brand" />
                      </span>
                      <span className="font-bold text-ink">
                        {m.kind === 'error' ? (
                          'Request Update'
                        ) : m.metadata?.source === 'gemini' && !m.metadata.offline ? (
                          <span>
                            Vyana AI · <span>Gemini</span> Clinical Engine
                          </span>
                        ) : m.metadata?.source === 'rules' ? (
                          'Vyana Clinical Rule Logic'
                        ) : (
                          'Offline Guidance'
                        )}
                      </span>
                    </div>
                  )}

                  <p className="whitespace-pre-wrap">{m.content}</p>

                  {/* Structured Sections if available */}
                  {m.metadata?.sections.map((section, index) => (
                    <section
                      key={index}
                      className="mt-3.5 pt-3 border-t border-line/70 bg-surface/60 rounded-xl p-3"
                    >
                      <h3 className="text-xs font-bold uppercase tracking-wider mb-1.5 text-brand flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" />
                        {section.title}
                      </h3>
                      <ul className="list-disc pl-5 space-y-1 text-xs text-body">
                        {section.items.map((item, itemIndex) => (
                          <li key={itemIndex} className="whitespace-pre-wrap">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}

                  {m.metadata?.retry_after_seconds && (
                    <p className="mt-3 text-xs text-muted flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-warn" />
                      Wait at least {m.metadata.retry_after_seconds} seconds before sending another message.
                    </p>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Loading Spinner during request */}
          {busy && (
            <div className="flex items-center gap-3 text-xs font-semibold text-muted p-2">
              <span className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/20 grid place-content-center text-brand animate-pulse">
                <AiRobotIcon size={16} className="text-brand" />
              </span>
              <span>Analyzing medical context and generating clinical insight…</span>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Docked Input Screen (Integrated seamlessly at the bottom of the frame) */}
        <div className="border-t border-line bg-surface p-3 sm:p-4 shrink-0 space-y-2">
          {/* Status Message */}
          <p role="status" aria-atomic="true" className="text-[11px] text-muted px-1 truncate">
            {statusMessage}
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="relative flex items-center gap-2 bg-surface-soft/80 border border-line rounded-2xl p-1.5 focus-within:border-brand focus-within:bg-white focus-within:ring-2 focus-within:ring-brand/20 transition-all shadow-2xs"
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              className="hidden"
              onChange={onFile}
            />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              aria-label="Upload a health report (PDF or image)"
              title="Upload health document or lab report (PDF, PNG, JPG up to 10MB)"
              className="min-w-[44px] min-h-[44px] rounded-xl text-muted hover:text-brand hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand shrink-0 grid place-content-center"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <input
              ref={inputRef}
              maxLength={4000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a health question or describe symptoms…"
              aria-label="Message the assistant"
              className="flex-1 bg-transparent px-2 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none min-w-0"
            />

            <button
              ref={sendRef}
              type={busy ? 'button' : 'submit'}
              disabled={!busy && !input.trim()}
              aria-label={busy ? 'Stop response' : 'Send message'}
              onClick={
                busy
                  ? () => {
                      active.current?.abort();
                      inputRef.current?.focus();
                    }
                  : undefined
              }
              className={`min-w-[44px] min-h-[44px] rounded-xl transition-all shrink-0 grid place-content-center ${
                busy
                  ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
                  : input.trim()
                  ? 'bg-brand hover:bg-brand-hover text-white shadow-xs'
                  : 'bg-surface-soft text-muted cursor-not-allowed'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
            >
              {busy ? <Square className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
