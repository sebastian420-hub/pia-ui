import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, X } from 'lucide-react';
import { apiJson } from '../../lib/api';

interface Message { role: 'user' | 'assistant'; content: string }
interface Props { onClose: () => void }

/** Assistant panel: answers from the last 7 days of reports. Rendered by the parent in a fixed slot. */
const AICopilot: React.FC<Props> = ({ onClose }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Ask about recent reports. Answers are limited to what is in the database.' },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    const text = input.trim();
    setInput('');
    setMessages(p => [...p, { role: 'user', content: text }]);
    setIsTyping(true);
    const r = await apiJson('/api/v1/chat', { message: text, history: messages.slice(-20).map(m => ({ role: m.role, content: m.content })) });
    setMessages(p => [...p, { role: 'assistant', content: r.status === 'success' && r.reply ? (r.reply as string) : `Error: ${r.message || 'assistant unavailable'}` }]);
    setIsTyping(false);
  };

  return (
    <div className="w-96 h-[460px] bg-bg-1 border border-line rounded shadow-xl flex flex-col font-mono text-[12px]">
      <div className="px-3 py-2 border-b border-line flex items-center justify-between">
        <span className="tracking-[0.2em] text-text-2 flex items-center gap-2"><Bot size={13} /> ASSISTANT</span>
        <button onClick={onClose} className="text-text-3 hover:text-text-1"><X size={14} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded px-2.5 py-2 leading-relaxed border ${m.role === 'user' ? 'bg-bg-3 border-line text-text-1' : 'bg-bg-2 border-line text-text-2'}`}>
              <div className="text-[10px] text-text-3 mb-0.5 flex items-center gap-1">{m.role === 'user' ? <><User size={10} /> YOU</> : <><Bot size={10} /> ASSISTANT</>}</div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          </div>
        ))}
        {isTyping && <div className="text-text-3 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> working…</div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="p-2 border-t border-line">
        <div className="relative">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about recent reports…" disabled={isTyping}
            className="w-full bg-bg-0 border border-line text-text-1 rounded py-2 pl-2 pr-8 focus:outline-none focus:border-accent placeholder:text-text-3" />
          <button type="submit" disabled={!input.trim() || isTyping} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-1 disabled:opacity-40"><Send size={14} /></button>
        </div>
      </form>
    </div>
  );
};

export default AICopilot;
