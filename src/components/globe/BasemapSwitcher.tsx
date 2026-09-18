/**
 * BasemapSwitcher — floating map-style picker overlaid on the Cesium globe.
 * Like Google Maps' "Map / Satellite" toggle but with 5 styles.
 */
import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { BASEMAPS } from '../../lib/basemaps';
import type { BasemapId } from '../../lib/basemaps';

interface Props {
  current: BasemapId;
  onChange: (id: BasemapId) => void;
}

export const BasemapSwitcher: React.FC<Props> = ({ current, onChange }) => {
  const [open, setOpen] = useState(false);
  const currentDef = BASEMAPS.find(b => b.id === current) ?? BASEMAPS[0];

  return (
    <div className="absolute bottom-8 left-3 z-10 select-none">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Change map style"
        className={`flex items-center gap-1.5 px-2 py-1 rounded border font-mono text-[11px] tracking-widest transition-colors backdrop-blur-sm
          ${open
            ? 'border-accent text-text-1 bg-bg-2/90'
            : 'border-line text-text-2 bg-bg-1/80 hover:text-text-1 hover:border-accent/60'
          }`}
      >
        <Layers size={11} />
        <span>{currentDef.icon}</span>
        <span>{currentDef.label.toUpperCase()}</span>
      </button>

      {/* Style grid — appears above the toggle button */}
      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div className="fixed inset-0 z-0" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full mb-2 left-0 w-64 bg-bg-1/95 backdrop-blur-md border border-line rounded-lg shadow-2xl p-2 z-10">
            <p className="text-[10px] text-text-3 font-mono tracking-widest px-1 pb-2 border-b border-line mb-2">
              MAP STYLE
            </p>
            <div className="grid grid-cols-5 gap-1">
              {BASEMAPS.map(bm => (
                <button
                  key={bm.id}
                  onClick={() => { onChange(bm.id); setOpen(false); }}
                  title={bm.description}
                  className={`flex flex-col items-center gap-0.5 p-1.5 rounded text-[10px] font-mono transition-all
                    ${current === bm.id
                      ? 'bg-accent/20 border border-accent/60 text-text-1 scale-105'
                      : 'border border-transparent text-text-3 hover:bg-bg-2 hover:text-text-2 hover:border-line'
                    }`}
                >
                  <span className="text-xl leading-tight">{bm.icon}</span>
                  <span className="truncate w-full text-center leading-tight">{bm.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
