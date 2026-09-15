import React, { useEffect, useState, useRef } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';

import { apiFetch } from '../../lib/api';

// Polls /api/v1/logs; a WebSocket stream would be the production shape.
const TerminalLog: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLogs = () => {
      apiFetch<string[]>('/api/v1/logs').then(data => {
        if (data.status === 'success' && data.data) {
          const newLogs = [...data.data].reverse(); // Newest at bottom
          // Only update if logs changed to avoid constant re-rendering
          setLogs(prev => (JSON.stringify(prev) !== JSON.stringify(newLogs) ? newLogs : prev));
        } else if (data.status === 'error') {
          console.error('Failed to fetch logs:', data.message);
        }
      });
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
    <div className="h-28 shrink-0 bg-bg-1 border-t border-line flex flex-col font-mono text-[11px]">
      <div className="px-3 py-1 border-b border-line text-text-3 tracking-[0.2em] flex items-center gap-2">
        <TerminalIcon size={12} /> AGENT LOG
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5 text-text-2 no-scrollbar">
        {logs.length === 0 ? (
          <div className="text-text-3">Waiting for agent activity…</div>
        ) : (
          logs.map((log, i) => {
            let colorClass = 'text-text-2';
            if (log.includes('ERROR')) colorClass = 'text-err';
            else if (log.includes('PROCESSING')) colorClass = 'text-warn';
            return <div key={i} className={`${colorClass} truncate`}>{log}</div>;
          })
        )}
      </div>
    </div>
  );
};

export default TerminalLog;