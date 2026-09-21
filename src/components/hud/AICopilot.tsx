import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, X } from 'lucide-react';
import { apiJson } from '../../lib/api';

export interface ChatSource { n: number; kind: 'event' | 'report' | 'relation' | 'entity' | 'fact' | 'listing'; id: string; label: string; entity_id?: string | null; other_id?: string | null; source_id?: string | null }
interface ChatData { sources: ChatSource[]; entities: { entity_id: string; name: string; kind: string }[]; missing: string[]; window_days: number; kind: string; context_items: number }
interface Message { role: 'user' | 'assistant'; content: string; data?: ChatData }
interface Props {
  onClose: () => void;
  onOpenEntity?: (key: string) => void;
  onOpenReport?: (uid: string) => void;
  onOpenEvidence?: (a: string, b: string) => void;
  suggestions?: string[];
}

const SUGGESTED = ['Anything new today?', 'What is happening between Iran and the United States this week?', 'Who is on a sanctions list among the people in the news this week?'];

/** The assistant: answers from the web with [n] citations; every number is a chip that opens what it rests on. */
const AICopilot: React.FC<Props> = ({ onClose, onOpenEntity, onOpenReport, onOpenEvidence, suggestions }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Ask about anyone or anything in the web — what happened, who someone is, why two things are connected, what is new. Every answer shows its sources; what the web does not hold, I say so.' },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  const ask = async (text: string) => {
    if (!text.trim() || isTyping) return;
    setInput('');
    setMessages(p => [...p, { role: 'user', content: text }]);
    setIsTyping(true);
    const r = await apiJson<ChatData>('/api/v1/chat', { message: text, history: messages.slice(-20).map(m => ({ role: m.role, content: m.content })) });
    setMessages(p => [...p, r.status === 'success' && r.reply
      ? { role: 'assistant', content: r.reply as string, data: r.data }
      : { role: 'assistant', content: `Error: ${r.message || 'assistant unavailable'}` }]);
    setIsTyping(false);
  };

  const open = (s: ChatSource) => {
    if (s.kind === 'report' && onOpenReport) onOpenReport(s.id);
    else if ((s.kind === 'event' || s.kind === 'relation') && s.entity_id && s.other_id && onOpenEvidence) onOpenEvidence(s.entity_id, s.other_id);
    else if (s.entity_id && onOpenEntity) onOpenEntity(s.entity_id);
  };

  /** "text [3][7] more" → text with clickable chips. */
  const withChips = (m: Message) => {
    const byN = new Map((m.data?.sources ?? []).map(s => [s.n, s]));
    const parts = m.content.split(/(\[\d{1,3}\])/g);
    return parts.map((p, i) => {
      const mm = /^\[(\d{1,3})\]$/.exec(p);
      if (!mm) return <span key={i}>{p}</span>;
      const s = byN.get(Number(mm[1]));
      if (!s) return <span key={i} className="text-text-3">{p}</span>;
      return (
        <button key={i} type="button" onClick={() => open(s)} title={`${s.kind}: ${s.label}`}
          className="mx-0.5 px-1 rounded bg-accent/15 text-accent text-[10px] align-middle hover:bg-accent/30">{s.n}</button>
      );
    });
  };

  return (
    <div className="w-[420px] h-[520px] bg-bg-1 border border-line rounded shadow-xl flex flex-col font-mono text-[12px]">
      <div className="px-3 py-2 border-b border-line flex items-center justify-between">
        <span className="tracking-[0.2em] text-text-2 flex items-center gap-2"><Bot size={13} /> ASSISTANT</span>
        <button onClick={onClose} className="text-text-3 hover:text-text-1"><X size={14} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[92%] rounded px-2.5 py-2 leading-relaxed border ${m.role === 'user' ? 'bg-bg-3 border-line text-text-1' : 'bg-bg-2 border-line text-text-2'}`}>
              <div className="text-[10px] text-text-3 mb-0.5 flex items-center gap-1">{m.role === 'user' ? <><User size={10} /> YOU</> : <><Bot size={10} /> ASSISTANT</>}</div>
              <div className="whitespace-pre-wrap">{m.role === 'assistant' && m.data ? withChips(m) : m.content}</div>
              {m.data && (
                <div className="mt-1.5 pt-1.5 border-t border-line text-[10px] text-text-3 flex flex-wrap gap-x-2 gap-y-0.5">
                  <span>{m.data.sources.length} source{m.data.sources.length === 1 ? '' : 's'} of {m.data.context_items} · last {m.data.window_days} d</span>
                  {m.data.entities.map(e => (
                    <button key={e.entity_id} type="button" onClick={() => onOpenEntity?.(e.entity_id)} className="text-accent hover:underline">{e.name} ↗</button>
                  ))}
                  {m.data.missing.length > 0 && <span className="text-warn">not found: {m.data.missing.join(', ')}</span>}
                </div>
              )}
            </div>
          </div>
        ))}
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-1">
            {(suggestions?.length ? suggestions : SUGGESTED).map(s => (
              <button key={s} type="button" onClick={() => ask(s)} className="px-2 py-1 rounded border border-line text-text-3 hover:text-text-1 hover:border-accent text-left">{s}</button>
            ))}
          </div>
        )}
        {isTyping && <div className="text-text-3 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> reading the web…</div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="p-2 border-t border-line">
        <div className="relative">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the web…" disabled={isTyping}
            className="w-full bg-bg-0 border border-line text-text-1 rounded py-2 pl-2 pr-8 focus:outline-none focus:border-accent placeholder:text-text-3" />
          <button type="submit" disabled={!input.trim() || isTyping} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-1 disabled:opacity-40"><Send size={14} /></button>
        </div>
      </form>
    </div>
  );
};

export default AICopilot;
