import React from 'react';
import { Layers } from 'lucide-react';
import type { LayerCount } from '../../lib/types';

export type LayerId = 'reports' | 'entities' | 'situations' | 'cameras';

interface LayerRailProps {
  counts: LayerCount[];
  enabled: Record<LayerId, boolean>;
  onToggle: (id: LayerId) => void;
}

const ORDER: LayerId[] = ['reports', 'entities', 'situations', 'cameras'];

/** Layer toggles with counts; sits at the top of the left rail. */
const LayerRail: React.FC<LayerRailProps> = ({ counts, enabled, onToggle }) => {
  const byId = Object.fromEntries(counts.map(c => [c.layer_id, c]));
  return (
    <div className="border-b border-line">
      <div className="px-3 py-1.5 text-[11px] tracking-[0.2em] text-text-3 flex items-center gap-2 font-mono">
        <Layers size={12} /> LAYERS
      </div>
      <ul className="pb-1">
        {ORDER.map(id => {
          const c = byId[id];
          const on = enabled[id];
          return (
            <li key={id}>
              <button
                onClick={() => onToggle(id)}
                className={`w-full flex items-center justify-between px-3 py-1 font-mono text-[12px] hover:bg-bg-2 ${on ? 'text-text-1' : 'text-text-3'}`}
              >
                <span className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-sm ${on ? (id === 'cameras' ? 'bg-camera' : 'bg-accent') : 'bg-line'}`} />
                  {c?.label ?? id}
                </span>
                <span className="tabular-nums">{c ? c.count.toLocaleString() : '—'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default LayerRail;
