import React, { useState } from 'react';
import type { IntelligenceEvent } from '../../lib/types';
import { zuluShort } from '../../lib/format';
import { DOMAIN_ABBR, priorityText } from '../../lib/symbology';
export type { IntelligenceEvent } from '../../lib/types';

interface LiveTickerProps {
  events: IntelligenceEvent[];
  selectedUid?: string | null;
  onEventClick: (event: IntelligenceEvent) => void;
}

type PriorityFilter = 'ALL' | 'HIGH+' | 'CRITICAL';

/** Dense report feed: one 26 px row per report — time · priority · domain · headline. */
const LiveTicker: React.FC<LiveTickerProps> = ({ events, selectedUid, onEventClick }) => {
  const [filter, setFilter] = useState<PriorityFilter>('ALL');

  const rows = events.filter(e => {
    if (e.source_type === 'SYSTEM' || e.headline?.startsWith('Situation:')) return false;
    if (filter === 'CRITICAL') return e.priority === 'CRITICAL';
    if (filter === 'HIGH+') return e.priority === 'CRITICAL' || e.priority === 'HIGH';
    return true;
  });
  const alerts = rows.filter(e => e.priority === 'CRITICAL' || e.priority === 'HIGH').slice(-5).reverse();
  const display = [...rows].reverse().slice(0, 150);

  const Row = ({ e, alert }: { e: IntelligenceEvent; alert?: boolean }) => (
    <button
      onClick={() => onEventClick(e)}
      className={`w-full grid grid-cols-[46px_28px_30px_1fr] gap-2 items-center px-3 h-[26px] text-left hover:bg-bg-2 border-l-2 ${
        selectedUid === e.uid ? 'bg-bg-2 border-accent' : alert ? 'border-prio-high/60' : 'border-transparent'
      }`}
      title={e.headline}
    >
      <span className="text-text-3 tabular-nums">{zuluShort(e.created_at)}</span>
      <span className={`${priorityText(e.priority)} font-semibold`}>{(e.priority || 'N').slice(0, 1)}</span>
      <span className="text-text-3">{DOMAIN_ABBR[e.domain] ?? 'UNK'}</span>
      <span className={`truncate ${e.alert ? 'text-prio-high' : 'text-text-1'}`}>{e.headline?.startsWith('[SIM]') && <span className="text-text-3 mr-1">SIM</span>}{e.headline}</span>
    </button>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col font-mono text-[12px]">
      <div className="px-3 py-1.5 border-b border-line flex items-center justify-between">
        <span className="text-[11px] tracking-[0.2em] text-text-3">REPORTS · {display.length}</span>
        <div className="flex gap-1 text-[10px]">
          {(['ALL', 'HIGH+', 'CRITICAL'] as PriorityFilter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-1.5 py-0.5 rounded ${filter === f ? 'bg-bg-3 text-text-1' : 'text-text-3 hover:text-text-1'}`}>{f}</button>
          ))}
        </div>
      </div>

      {alerts.length > 0 && filter === 'ALL' && (
        <div className="border-b border-line bg-prio-high/5">
          <div className="px-3 pt-1 text-[10px] tracking-[0.2em] text-prio-high">ALERTS</div>
          {alerts.map(e => <Row key={`a-${e.uid}`} e={e} alert />)}
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {display.length === 0 && <div className="px-3 py-4 text-text-3">No reports in view.</div>}
        {display.map(e => <Row key={e.uid} e={e} />)}
      </div>
    </div>
  );
};

export default LiveTicker;
