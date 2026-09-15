import React, { useEffect, useState } from 'react';
import { Network, X, Camera, Loader2 } from 'lucide-react';
import type { IntelligenceEvent, Sensor } from '../../lib/types';
import { apiFetch } from '../../lib/api';
import { zuluDateTime } from '../../lib/format';
import { priorityText } from '../../lib/symbology';

interface EntityDossierProps {
  event: IntelligenceEvent;
  onClose: () => void;
  onOpenGraph: (entityName: string) => void;
  onOpenCamera: (sensorId: string) => void;
}

interface EventDetails { summary: string; entities: string[] }

/** Right-column body for a report: summary, entities, and cameras within 5 km. */
const EntityDossier: React.FC<EntityDossierProps> = ({ event, onClose, onOpenGraph, onOpenCamera }) => {
  const [details, setDetails] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameras, setCameras] = useState<Sensor[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) { setLoading(true); setDetails(null); setCameras(null); } });
    apiFetch<EventDetails>(`/api/v1/event/${event.uid}`).then(r => {
      if (cancelled) return;
      if (r.status === 'success' && r.data) setDetails(r.data);
      setLoading(false);
    });
    if (event.geo) {
      apiFetch<Sensor[]>(`/api/v1/sensors?near_lat=${event.geo.lat}&near_lon=${event.geo.lon}&radius_km=5&limit=8`)
        .then(r => { if (!cancelled && r.status === 'success' && r.data) setCameras(r.data); });
    }
    return () => { cancelled = true; };
  }, [event]);

  return (
    <div className="h-full flex flex-col font-mono text-[12px]">
      <div className="px-3 py-2 border-b border-line flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] tracking-[0.2em] text-text-3">REPORT · {event.source_type ?? '—'}</div>
          <div className="text-text-1 text-[13px] leading-snug">{event.headline}</div>
          <div className="flex gap-3 text-text-3 mt-1">
            <span className={priorityText(event.priority)}>{event.priority}</span>
            <span>{event.domain}</span>
            <span>{zuluDateTime(event.created_at)}</span>
          </div>
        </div>
        <button onClick={onClose} className="text-text-3 hover:text-text-1 p-1"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-4">
        <section>
          <h3 className="text-[10px] tracking-[0.2em] text-text-3 mb-1">SUMMARY</h3>
          {loading ? <div className="text-text-3 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> loading</div>
            : <p className="text-text-2 leading-relaxed">{details?.summary ?? '—'}</p>}
        </section>

        <section>
          <h3 className="text-[10px] tracking-[0.2em] text-text-3 mb-1">ENTITIES</h3>
          {details && details.entities.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {details.entities.map(name => (
                <button key={name} onClick={() => onOpenGraph(name)}
                  className="px-1.5 py-0.5 border border-line rounded text-text-2 hover:text-text-1 hover:border-accent flex items-center gap-1">
                  <Network size={10} /> {name}
                </button>
              ))}
            </div>
          ) : <div className="text-text-3">{loading ? '' : 'None extracted yet.'}</div>}
        </section>

        <section>
          <h3 className="text-[10px] tracking-[0.2em] text-text-3 mb-1 flex items-center gap-1"><Camera size={11} /> CAMERAS WITHIN 5 KM</h3>
          {!event.geo ? <div className="text-text-3">Report has no position.</div>
            : cameras === null ? <div className="text-text-3">…</div>
            : cameras.length === 0 ? <div className="text-text-3">No public cameras near this position.</div>
            : (
              <ul className="divide-y divide-line border border-line rounded">
                {cameras.map(c => (
                  <li key={c.sensor_id}>
                    <button onClick={() => onOpenCamera(c.sensor_id)} className="w-full text-left px-2 py-1 hover:bg-bg-2 flex items-center justify-between gap-2">
                      <span className="truncate text-text-1">{c.name}</span>
                      <span className="text-text-3 shrink-0">{c.provider}{c.has_video ? ' · video' : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <dl className="grid grid-cols-[80px_1fr] gap-y-1 text-text-3 border-t border-line pt-2">
          <dt>RECORD</dt><dd className="truncate text-text-2" title={event.uid}>{event.uid}</dd>
          {event.geo && <><dt>POSITION</dt><dd className="tabular-nums text-text-2">{event.geo.lat.toFixed(4)}, {event.geo.lon.toFixed(4)}</dd></>}
        </dl>
      </div>
    </div>
  );
};

export default EntityDossier;
