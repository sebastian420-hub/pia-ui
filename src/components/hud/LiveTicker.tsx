import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Newspaper, Plane, Activity, Cpu, Radio, AlertTriangle } from 'lucide-react';

export interface IntelligenceEvent {
  uid: string;
  source_type?: string;
  priority: string;
  domain: string;
  headline?: string;
  name?: string;
  geo: { lat: number; lon: number; } | null;
}

interface LiveTickerProps {
  events: IntelligenceEvent[];
  onEventClick: (event: IntelligenceEvent) => void;
}

const getPriorityColor = (priority: string) => {
  switch (priority?.toUpperCase()) {
    case 'CRITICAL': return 'bg-sentinel-critical text-white';
    case 'HIGH': return 'bg-sentinel-high text-white';
    case 'NORMAL': return 'bg-sentinel-normal text-black';
    default: return 'bg-sentinel-blue text-white';
  }
};

const getBorderColor = (priority: string) => {
  switch (priority?.toUpperCase()) {
    case 'CRITICAL': return 'border-sentinel-critical';
    case 'HIGH': return 'border-sentinel-high';
    case 'NORMAL': return 'border-sentinel-normal';
    default: return 'border-sentinel-blue';
  }
};

const getSourceIcon = (sourceType?: string, domain?: string) => {
  const st = (sourceType || '').toUpperCase();
  const dom = (domain || '').toUpperCase();
  
  if (st === 'OSINT') return <Newspaper size={14} />;
  if (st === 'GEOINT' || dom === 'AVIATION') return <Plane size={14} />;
  if (dom === 'NATURAL' || dom === 'SEISMIC') return <Activity size={14} />;
  if (st === 'SYSTEM') return <Cpu size={14} />;
  if (st === 'SIGINT') return <Radio size={14} />;
  
  return <AlertTriangle size={14} />;
};

type PriorityFilter = 'ALL' | 'HIGH+' | 'CRITICAL';

const LiveTicker: React.FC<LiveTickerProps> = ({ events, onEventClick }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState<PriorityFilter>('ALL');

  const filteredEvents = events.filter(e => {
    // 1. Remove systemic cluster noise from the raw intelligence ticker
    if (e.source_type === 'SYSTEM' || e.headline?.startsWith('Situation:')) return false;

    // 2. Apply priority filters
    if (filter === 'CRITICAL') return e.priority === 'CRITICAL';
    if (filter === 'HIGH+') return e.priority === 'CRITICAL' || e.priority === 'HIGH';
    return true; // ALL
  });

  const displayEvents = [...filteredEvents].reverse().slice(0, 50);

  return (
    <>
      <motion.div 
        className="absolute top-0 left-0 h-full bg-black/60 backdrop-blur-md border-r border-white/10 z-10 flex flex-col font-mono text-sm"
        initial={{ width: 320 }}
        animate={{ width: isExpanded ? 320 : 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <div className="p-4 border-b border-white/10 flex flex-col gap-3 overflow-hidden whitespace-nowrap">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold tracking-wider">LIVE FEED // {displayEvents.length}</h2>
          </div>
          
          <div className="flex gap-2 text-xs">
            <button 
              onClick={() => setFilter('ALL')}
              className={`px-2 py-1 rounded transition-colors ${filter === 'ALL' ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10'}`}
            >
              ALL
            </button>
            <button 
              onClick={() => setFilter('HIGH+')}
              className={`px-2 py-1 rounded transition-colors ${filter === 'HIGH+' ? 'bg-sentinel-high/40 text-sentinel-high' : 'text-white/50 hover:bg-white/10'}`}
            >
              HIGH+
            </button>
            <button 
              onClick={() => setFilter('CRITICAL')}
              className={`px-2 py-1 rounded transition-colors ${filter === 'CRITICAL' ? 'bg-sentinel-critical/40 text-sentinel-critical' : 'text-white/50 hover:bg-white/10'}`}
            >
              CRITICAL
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-2 no-scrollbar">
          <AnimatePresence>
            {isExpanded && displayEvents.map((event) => (
              <motion.div
                key={event.uid}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className={`p-3 rounded bg-white/5 border-l-4 ${getBorderColor(event.priority)} cursor-pointer hover:bg-white/10 transition-colors whitespace-normal flex flex-col gap-1`}
                onClick={() => onEventClick(event)}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white/60" title={`Source: ${event.source_type}`}>
                      {getSourceIcon(event.source_type, event.domain)}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${getPriorityColor(event.priority)}`}>
                      {event.priority || 'UNK'}
                    </span>
                  </div>
                  <span className="text-white/50 text-xs truncate max-w-[100px]">{event.domain}</span>
                </div>
                <p className="text-white/90 line-clamp-2 leading-tight">{event.headline}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Collapse Toggle Button */}
      <motion.button
        className="absolute top-4 z-20 bg-black/80 backdrop-blur border border-white/20 text-white p-1.5 rounded-r cursor-pointer hover:bg-white/10 transition-colors"
        animate={{ left: isExpanded ? 320 : 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? "Collapse Feed" : "Expand Feed"}
      >
        {isExpanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </motion.button>
    </>
  );
};

export default LiveTicker;
