import React, { useEffect, useState } from 'react';
import { X, Camera, ExternalLink } from 'lucide-react';
import { apiFetch, mediaUrl } from '../../lib/api';
import { zuluDateTime } from '../../lib/format';
import type { Sensor } from '../../lib/types';

interface CameraInspectorProps {
  sensorId: string;
  onClose: () => void;
}

/** Right-column body for a camera: live snapshot (auto-refresh) or clip, provenance, source class. */
const CameraInspector: React.FC<CameraInspectorProps> = ({ sensorId, onClose }) => {
  const [cam, setCam] = useState<Sensor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bust, setBust] = useState<number>(() => Date.now());
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [age, setAge] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Sensor>(`/api/v1/sensors/${sensorId}`).then(r => {
      if (cancelled) return;
      if (r.status === 'success' && r.data) { setCam(r.data); setError(null); }
      else setError(r.message || 'Camera not found');
    });
    return () => { cancelled = true; };
  }, [sensorId]);

  // Refresh the still at the provider's cadence; count the age every second.
  useEffect(() => {
    if (!cam) return;
    const refresh = Math.max(5, cam.refresh_seconds) * 1000;
    const r = setInterval(() => setBust(Date.now()), refresh);
    const a = setInterval(() => setAge(fetchedAt ? Math.round((Date.now() - fetchedAt) / 1000) : 0), 1000);
    return () => { clearInterval(r); clearInterval(a); };
  }, [cam, fetchedAt]);

  const snapshot = cam ? mediaUrl(`/api/v1/sensors/${cam.sensor_id}/snapshot`, bust) : '';
  const video = cam?.has_video ? mediaUrl(`/api/v1/sensors/${cam.sensor_id}/video`, bust) : null;
  const isClip = cam?.provider === 'tfl';

  return (
    <div className="h-full flex flex-col font-mono text-[12px]">
      <div className="px-3 py-2 border-b border-line flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] tracking-[0.2em] text-camera flex items-center gap-1"><Camera size={11} /> CAMERA</div>
          <div className="text-text-1 text-[13px] leading-tight truncate" title={cam?.name ?? ''}>{cam?.name ?? '…'}</div>
          <div className="text-text-3">{[cam?.city, cam?.country_code].filter(Boolean).join(', ')}</div>
        </div>
        <button onClick={onClose} className="text-text-3 hover:text-text-1 p-1"><X size={16} /></button>
      </div>

      <div className="p-3 space-y-3 overflow-y-auto no-scrollbar">
        {error && <div className="text-err">{error}</div>}
        {cam && (
          <>
            <div className="bg-bg-0 border border-line rounded overflow-hidden aspect-[4/3] flex items-center justify-center">
              {video && isClip ? (
                <video key={bust} src={video} autoPlay muted loop playsInline className="w-full h-full object-contain" />
              ) : (
                <img key={bust} src={snapshot} alt={cam.name ?? 'camera'} className="w-full h-full object-contain"
                     onLoad={() => setFetchedAt(Date.now())} onError={() => setError('Snapshot unavailable')} />
              )}
            </div>
            <div className="flex items-center justify-between text-text-3">
              <span>{isClip ? '10 s clip' : `still · ${age}s ago`} · refresh {cam.refresh_seconds}s</span>
              <span className={cam.status === 'ONLINE' ? 'text-ok' : cam.status === 'OFFLINE' ? 'text-err' : 'text-text-3'}>{cam.status}</span>
            </div>

            <dl className="grid grid-cols-[90px_1fr] gap-y-1 text-text-2">
              <dt className="text-text-3">SOURCE</dt><dd>{cam.provider}{cam.requires_relay ? ' · via US relay' : ''}</dd>
              <dt className="text-text-3">CLASS</dt><dd>{cam.cost_class}</dd>
              <dt className="text-text-3">LAST OK</dt><dd>{zuluDateTime(cam.last_ok)}</dd>
              <dt className="text-text-3">POSITION</dt><dd className="tabular-nums">{cam.geo.lat.toFixed(5)}, {cam.geo.lon.toFixed(5)}</dd>
              <dt className="text-text-3">ID</dt><dd className="truncate" title={cam.external_id}>{cam.external_id}</dd>
            </dl>
            <div className="text-[11px] text-text-3 border-t border-line pt-2">{cam.attribution}</div>
            <a href={snapshot} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
              <ExternalLink size={12} /> open image
            </a>
          </>
        )}
      </div>
    </div>
  );
};

export default CameraInspector;
