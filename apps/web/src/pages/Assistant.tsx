import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Paperclip } from 'lucide-react';
import { apiJson } from '../services/api';

type Msg = { role: 'user' | 'assistant'; content: string };

const QUICK = [
  'Suggest a simple diet plan for my goal',
  'How am I doing today?',
  'Tips to improve my BMI',
];

export default function Assistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }, [messages, sending]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending || uploading) return;
    setInput('');
    const history = messages.slice(-8).map(turn => ({...turn, content: turn.content.slice(0, 8000)}));
    setMessages((m) => [...m, { role: 'user', content: msg }]);
    setSending(true);
    try {
      const data = await apiJson<{reply: string}>('/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ message: msg, history }),
      });
      setMessages((m) => [...m, { role: 'assistant', content: data.reply || 'No response.' }]);
    } catch (error) {
      setMessages((m) => [...m, { role: 'assistant', content: error instanceof Error ? error.message : 'Could not reach the assistant. Please try again.' }]);
    } finally {
      setSending(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.type)) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Please upload a PDF, PNG, or JPG file.' }]);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessages((m) => [...m, { role: 'assistant', content: 'That file is larger than 10 MB. Please upload a smaller file.' }]);
      return;
    }
    setMessages((m) => [...m, { role: 'user', content: `ðŸ“Ž Uploaded report: ${file.name}` }]);
    setUploading(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const b64 = dataUrl.split(',')[1] || '';
      const data = await apiJson<{summary: string; discussion_points: string[]}>('/assistant/report', {
        method: 'POST',
        body: JSON.stringify({ data_base64: b64, mime_type: file.type, filename: file.name }),
      });
      const points = (data.discussion_points || []).map((p: string) => `â€¢ ${p}`).join('\n');
      const content = (data.summary || 'No summary available.') + (points ? `\n\n${points}` : '');
      setMessages((m) => [...m, { role: 'assistant', content }]);
    } catch (error) {
      setMessages((m) => [...m, { role: 'assistant', content: error instanceof Error ? error.message : 'Could not analyze that report. Please try again.' }]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-full">
      <div className="flex items-center gap-3 mb-1">
        <Sparkles className="w-7 h-7 text-brand" />
        <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
      </div>
      <p className="text-[12px] text-gray-600 mb-4">AI guidance only â€” not a substitute for professional medical care.</p>

      <div role="log" aria-live="polite" aria-label="Conversation" className="flex-1 overflow-y-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-10">
            <p className="text-gray-500 text-sm mb-5">Ask about your vitals, activity, diet, or goals.</p>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {QUICK.map((q) => (
                <button key={q} type="button" onClick={() => send(q)}
                  className="text-[13px] text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] break-words rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-brand text-white' : 'bg-surface-soft text-ink'
              }`}>
                {m.content}
              </div>
            </div>
          ))
        )}
        {(sending || uploading) && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-600 rounded-2xl px-4 py-2.5 text-[14px]">{uploading ? 'Analysing reportâ€¦' : 'Thinkingâ€¦'}</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-4 flex items-center gap-2">
        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="hidden" onChange={onFile} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || sending} aria-label="Upload a health report (PDF or image)" className="p-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          maxLength={4000}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the assistantâ€¦"
          aria-label="Message the assistant"
          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        />
        <button type="submit" disabled={sending || uploading || !input.trim()} aria-label="Send message"
          className="p-3 rounded-xl bg-brand text-white hover:bg-brand-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
