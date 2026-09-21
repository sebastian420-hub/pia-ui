import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, Pencil } from 'lucide-react';
import { ago } from '../../lib/format';
import type { Mission } from '../../lib/types';
import type { MissionScope } from '../../lib/missions';

interface Props {
  missions: Mission[];
  active: Mission | null;
  scope: MissionScope;
  onScope: (s: MissionScope) => void;
  onActivate: (id: string) => void;
  onEdit?: (m: Mission | null) => void;  // null = new; absent for viewers
}

/** `MISSION ▾` in the status bar: pick the active mission, show all / mission only, new, edit. */
const MissionSwitcher: React.FC<Props> = ({ missions, active, scope, onScope, onActivate, onEdit }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [open]);

  const narrow = !!active && !active.is_general;
  const [now, setNow] = useState(() => Date.now());
  const toggleOpen = () => { setNow(Date.now()); setOpen(v => !v); };
  return (
    <div ref={ref} className="relative">
      <button onClick={toggleOpen} className="flex items-center gap-1 hover:text-text-1" title="Missions: collect broadly, look narrowly">
        MISSION <span className={`${narrow ? 'text-accent' : 'text-text-1'} uppercase`}>{active?.name ?? '—'}</span>
        {narrow && scope === 'all' && <span className="text-text-3">(showing all)</span>}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 w-80 bg-bg-1 border border-line rounded shadow-xl z-50 font-mono text-[12px]">
          <ul className="max-h-72 overflow-auto py-1">
            {missions.map(m => (
              <li key={m.mission_id} className={`flex items-center gap-2 px-2 py-1 hover:bg-bg-2 ${m.is_active ? 'text-text-1' : 'text-text-2'}`}>
                <button onClick={() => { onActivate(m.mission_id); setOpen(false); }} className="flex-1 text-left flex items-center gap-2 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.is_active ? 'bg-accent' : 'bg-line'}`} />
                  <span className="truncate">{m.name}</span>
                  <span className="ml-auto text-text-3 shrink-0 tabular-nums">
                    {m.is_general ? 'everything' : `${m.events ?? 0} ev · ${m.alerts ?? 0} alerts`}
                  </span>
                </button>
                {onEdit && <button onClick={() => { onEdit(m); setOpen(false); }} className="text-text-3 hover:text-text-1" title="Edit"><Pencil size={11} /></button>}
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-2 py-1.5 flex items-center gap-2">
            {onEdit && <button onClick={() => { onEdit(null); setOpen(false); }} className="flex items-center gap-1 text-text-2 hover:text-text-1"><Plus size={12} /> new mission</button>}
            {narrow && (
              <label className="ml-auto flex items-center gap-1 text-text-3 cursor-pointer" title="Show everything, not only what matters to this mission">
                <input type="checkbox" checked={scope === 'all'} onChange={e => onScope(e.target.checked ? 'all' : 'mission')} /> show all
              </label>
            )}
          </div>
          {active && narrow && (
            <div className="border-t border-line px-2 py-1.5 text-text-3 leading-5">
              {active.country_names?.length ? <div>countries: <span className="text-text-2">{active.country_names.join(', ')}</span></div> : null}
              {active.watchlist_names?.length ? <div>watching: <span className="text-text-2">{active.watchlist_names.join(', ')}</span></div> : null}
              {active.topics.length ? <div>topics: <span className="text-text-2">{active.topics.join(', ')}</span></div> : null}
              {active.last_alert ? <div>last alert {ago((now - new Date(active.last_alert).getTime()) / 1000)}</div> : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MissionSwitcher;
