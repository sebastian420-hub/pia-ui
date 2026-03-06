import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Terminal as TerminalIcon } from 'lucide-react';

interface TerminalLogProps {
  // In a full production setup, this would be a WebSocket stream. 
  // For now, we will poll the /api/v1/logs endpoint.
}

const TerminalLog: React.FC<TerminalLogProps> = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLogs = () => {
      fetch('http://localhost:8001/api/v1/logs')
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success') {
            // Only update if logs changed to avoid constant re-rendering
            setLogs(prev => {
              const newLogs = data.data.reverse(); // Newest at bottom
              if (JSON.stringify(prev) !== JSON.stringify(newLogs)) {
                return newLogs;
              }
              return prev;
            });
          }
        })
        .catch(err => console.error("Failed to fetch logs:", err));
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 5000); // Poll every 5s

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <motion.div 
      initial={{ y: 200, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute bottom-0 left-0 w-full h-40 bg-black/80 backdrop-blur-md border-t border-white/10 z-20 flex flex-col font-mono text-xs"
    >
      <div className="bg-sentinel-blue/20 text-sentinel-blue px-4 py-1 border-b border-sentinel-blue/30 flex items-center gap-2">
        <TerminalIcon size={14} />
        <span className="font-bold tracking-widest">AGENT SWARM TERMINAL</span>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 text-white/70 no-scrollbar">
        {logs.length === 0 ? (
          <div className="animate-pulse">Awaiting swarm connection...</div>
        ) : (
          logs.map((log, i) => {
            // Color code based on log content
            let colorClass = 'text-white/70';
            if (log.includes('ERROR')) colorClass = 'text-sentinel-critical';
            if (log.includes('PROCESSING')) colorClass = 'text-sentinel-high animate-pulse';
            if (log.includes('COMPLETED')) colorClass = 'text-sentinel-blue';
            
            return (
              <div key={i} className={colorClass}>
                {log}
              </div>
            );
          })
        )}
        {/* Blinking cursor effect at the bottom */}
        <div className="w-2 h-3 bg-white/50 animate-ping mt-2"></div>
      </div>
    </motion.div>
  );
};

export default TerminalLog;