import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, Bot, User, Loader2, X } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AICopilot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Director, I am the Tactical AI Co-Pilot. How can I assist with your graph interrogation today?' }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    try {
      const response = await fetch('http://localhost:8001/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        }),
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `[SYSTEM ERROR]: ${data.message || 'Connection to Neural Core failed.'}` }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: '[SYSTEM ERROR]: Bridge offline.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      {!isOpen && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute bottom-44 right-8 z-30 bg-sentinel-blue/20 hover:bg-sentinel-blue/40 border border-sentinel-blue text-white p-4 rounded-full shadow-[0_0_20px_rgba(0,102,255,0.4)] transition-colors"
          onClick={() => setIsOpen(true)}
        >
          <MessageSquare size={24} />
        </motion.button>
      )}

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-44 right-8 w-96 h-[500px] z-50 bg-black/90 backdrop-blur-xl border border-sentinel-blue/30 rounded-lg shadow-[0_0_30px_rgba(0,102,255,0.2)] flex flex-col font-mono"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-white/10 bg-sentinel-blue/10 rounded-t-lg">
              <div className="flex items-center gap-2 text-sentinel-blue">
                <Bot size={18} />
                <span className="font-bold tracking-widest text-sm">TACTICAL CO-PILOT</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded p-3 text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-sentinel-blue/20 border border-sentinel-blue/30 text-white' 
                      : 'bg-white/5 border border-white/10 text-white/90'
                  }`}>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-1 opacity-50 text-[10px]">
                        <Bot size={12} /> SYSTEM
                      </div>
                    )}
                    {msg.role === 'user' && (
                      <div className="flex items-center justify-end gap-2 mb-1 opacity-50 text-[10px]">
                        DIRECTOR <User size={12} />
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 text-sentinel-blue p-3 rounded flex items-center gap-2 text-sm">
                    <Loader2 size={14} className="animate-spin" /> Synthesizing...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="p-3 border-t border-white/10 bg-black/50 rounded-b-lg">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask for an intelligence synthesis..."
                  className="w-full bg-white/5 border border-white/20 text-white text-sm rounded py-3 pl-3 pr-10 focus:outline-none focus:border-sentinel-blue transition-colors placeholder:text-white/30"
                  disabled={isTyping}
                />
                <button 
                  type="submit" 
                  disabled={!input.trim() || isTyping}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sentinel-blue hover:text-white disabled:opacity-50 disabled:hover:text-sentinel-blue transition-colors"
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AICopilot;