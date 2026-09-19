import React from 'react';
import { Layers } from 'lucide-react';
import type { LayerCount, WebWindow } from '../../lib/types';

export type LayerId = 'reports' | 'entities' | 'situations' | 'cameras' | 'events' | 'web';

interface LayerRailProps {
  counts: LayerCount[];
  enabled: Record<LayerId, boolean>;
  onToggle: (id: LayerId) => void;
  /** The web layer's small toolbar: time window and kind toggles (shown when the layer is on). */
  web?: {
    window: WebWindow; onWindow: (w: WebWindow) => void;
    hostile: boolean; cooperative: boolean; onKind: (k: 'hostile' | 'cooperative' | 'wire') => void;
    wire: boolean;
    arcs: number;
  };
}

const ORDER: LayerId[] = ['web', 'reports', 'events', 'entities', 'situations', 'cameras'];

/** Layer toggles with counts; sits at the top of the left rail. */
const LayerRail: React.FC<LayerRailProps> = ({ counts, enabled, onToggle, web }) => {
  const byId: Record<string, LayerCount | undefined> = Object.fromEntries(counts.map(c => [c.layer_id, c]));
  if (web) byId.web = { layer_id: 'web', label: 'Web', count: web.arcs };
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
                  <span className={`inline-block w-2 h-2 rounded-sm ${on ? (id === 'cameras' ? 'bg-camera' : id === 'events' ? 'bg-ok' : id === 'web' ? 'bg-prio-high' : 'bg-accent') : 'bg-line'}`} />
                  {c?.label ?? (id === 'web' ? 'Web' : id)}
                </span>
                <span className="tabular-nums">{c ? c.count.toLocaleString() : '—'}</span>
              </button>
              {id === 'web' && on && web && (
                <div className="px-3 pb-1.5 flex items-center gap-1 font-mono text-[10px]">
                  {(['24h', '7d', '30d', '90d'] as WebWindow[]).map(w => (
                    <button key={w} onClick={() => web.onWindow(w)}
                      className={`px-1.5 py-0.5 rounded border ${web.window === w ? 'border-line bg-bg-3 text-text-1' : 'border-transparent text-text-3'}`}>{w}</button>
                  ))}
                  <span className="mx-1 text-line">|</span>
                  <button onClick={() => web.onKind('hostile')} className={`px-1.5 py-0.5 rounded border ${web.hostile ? 'border-line bg-bg-3 text-text-1' : 'border-transparent text-text-3'}`}>
                    <span className="inline-block w-2.5 h-0.5 align-middle mr-1 bg-prio-critical" />hostile</button>
                  <button onClick={() => web.onKind('cooperative')} className={`px-1.5 py-0.5 rounded border ${web.cooperative ? 'border-line bg-bg-3 text-text-1' : 'border-transparent text-text-3'}`}>
                    <span className="inline-block w-2.5 h-0.5 align-middle mr-1 bg-ok" />coop</button>
                  <button onClick={() => web.onKind('wire')} title="also show pairs only the wire (GDELT) reports — unverified, faint"
                    className={`px-1.5 py-0.5 rounded border ${web.wire ? 'border-line bg-bg-3 text-text-1' : 'border-transparent text-text-3'}`}>wire</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default LayerRail;
