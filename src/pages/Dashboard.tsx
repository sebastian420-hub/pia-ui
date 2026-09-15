import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Viewer, Camera, Entity, PointGraphics, LabelGraphics, PointPrimitiveCollection, PointPrimitive,
  EllipseGraphics, BillboardCollection, Billboard, ScreenSpaceEventHandler, ScreenSpaceEvent,
} from 'resium';
import type { CesiumComponentRef } from 'resium';
import {
  Cartesian3, Cartesian2, Color, DistanceDisplayCondition, LabelStyle, Math as CesiumMath, Rectangle,
  Viewer as CesiumViewer, ImageryLayer, UrlTemplateImageryProvider, Ion, ScreenSpaceEventType,
  Entity as CesiumEntity, Credit, NearFarScalar,
} from 'cesium';
import { Network, Upload, MessageSquare } from 'lucide-react';
import StatusBar from '../components/frame/StatusBar';
import LayerRail from '../components/frame/LayerRail';
import type { LayerId } from '../components/frame/LayerRail';
import LiveTicker from '../components/hud/LiveTicker';
import RelationalWeb from '../components/hud/RelationalWeb';
import FilterBar from '../components/hud/FilterBar';
import EntityDossier from '../components/hud/EntityDossier';
import CameraInspector from '../components/hud/CameraInspector';
import TerminalLog from '../components/hud/TerminalLog';
import AICopilot from '../components/hud/AICopilot';
import DocumentUploader from '../components/hud/DocumentUploader';
import type { IntelligenceEvent, ClusterRow, ArchiveRecord, LayerCount, Sensor, Selection } from '../lib/types';
import { apiFetch, liveSocketUrl } from '../lib/api';
import { DOMAINS } from '../lib/domains';
import { priorityHex, CAMERA_HEX } from '../lib/symbology';

interface ClusterData { uid: string; name: string; domain: string; priority: string; lat: number; lon: number }

const MAX_EVENTS = 400;

/** Cesium's default imagery needs an ion token; the default here is a token-free dark basemap. */
const ionToken: string = import.meta.env.VITE_CESIUM_ION_TOKEN ?? '';
if (ionToken) Ion.defaultAccessToken = ionToken;

const CAMERA_SVG = (hex: string) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
       <rect x="2" y="5" width="10" height="8" rx="1.5" fill="${hex}" stroke="#07090c" stroke-width="1"/>
       <path d="M12 8 L16 6 V12 L12 10 Z" fill="${hex}" stroke="#07090c" stroke-width="1"/>
     </svg>`);
const CAMERA_ICONS = { online: CAMERA_SVG(CAMERA_HEX.online), unknown: CAMERA_SVG(CAMERA_HEX.unknown), offline: CAMERA_SVG(CAMERA_HEX.offline) };

function archiveToEvent(r: ArchiveRecord): IntelligenceEvent {
  return { uid: r.uid, source_type: r.source_type, priority: r.priority, domain: r.domain, headline: r.content_headline, created_at: r.created_at, geo: r.geo ?? null };
}

function Dashboard() {
  const [events, setEvents] = useState<IntelligenceEvent[]>([]);
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const [strategicEntities, setStrategicEntities] = useState<IntelligenceEvent[]>([]);
  const [cameras, setCameras] = useState<Sensor[]>([]);
  const [layerCounts, setLayerCounts] = useState<LayerCount[]>([]);
  const [layers, setLayers] = useState<Record<LayerId, boolean>>({ reports: true, entities: true, situations: true, cameras: true });
  const [activeGraphEntity, setActiveGraphEntity] = useState<string | null>(null);
  const [activeDomains, setActiveDomains] = useState<string[]>([...DOMAINS]);
  const [selection, setSelection] = useState<Selection>(null);
  const [feedStatus, setFeedStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [showCopilot, setShowCopilot] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [liveActive, setLiveActive] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const viewerRef = useRef<CesiumComponentRef<CesiumViewer>>(null);
  const bboxRef = useRef<string>('minLat=-90&minLon=-180&maxLat=90&maxLon=180');

  const baseLayer = useMemo(() => {
    if (ionToken) return undefined;
    // Esri "World Dark Gray Base": token-free, dark, low-saturation; attribution required.
    // (CARTO dark tiles now watermark "API KEY REQUIRED" for browser requests.)
    return new ImageryLayer(new UrlTemplateImageryProvider({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      credit: new Credit('Basemap: Esri, HERE, Garmin, © OpenStreetMap contributors, and the GIS user community', true),
      maximumLevel: 16,
    }));
  }, []);

  const addEvents = useCallback((incoming: IntelligenceEvent[]) => {
    setEvents(prev => {
      const seen = new Set(prev.map(e => e.uid));
      const fresh = incoming.filter(e => e.uid && !seen.has(e.uid));
      if (fresh.length === 0) return prev;
      const updated = [...prev, ...fresh];
      return updated.length > MAX_EVENTS ? updated.slice(updated.length - MAX_EVENTS) : updated;
    });
  }, []);

  const loadLayerCounts = useCallback(() => {
    apiFetch<LayerCount[]>('/api/v1/layers').then(r => { if (r.status === 'success' && r.data) setLayerCounts(r.data); });
  }, []);

  const loadStrategic = useCallback((query: string) => {
    apiFetch<IntelligenceEvent[]>(`/api/v1/entities/bbox?${query}`).then(r => {
      if (r.status === 'success' && r.data) setStrategicEntities(r.data);
    });
  }, []);

  const loadCameras = useCallback((query: string) => {
    apiFetch<Sensor[]>(`/api/v1/sensors?layer=cameras&${query}&limit=3000`).then(r => {
      if (r.status === 'success' && r.data) setCameras(r.data);
    });
  }, []);

  // Initial data: clusters, recent history, layer counts, live socket.
  useEffect(() => {
    apiFetch<ClusterRow[]>('/api/v1/clusters/active').then(r => {
      if (r.status !== 'success' || !r.data) return;
      setClusters(r.data
        .filter((c): c is ClusterRow & { lat: number; lon: number } => c.lat != null && c.lon != null)
        .map(c => ({ uid: c.cluster_id, name: c.name || 'Situation', priority: c.priority || 'NORMAL', domain: c.domain || 'UNKNOWN', lat: c.lat, lon: c.lon })));
    });
    apiFetch<ArchiveRecord[]>('/api/v1/archive?page=1&limit=150').then(r => {
      if (r.status === 'success' && r.data) addEvents([...r.data].reverse().map(archiveToEvent));
    });
    loadLayerCounts();
    const countsTimer = setInterval(loadLayerCounts, 60000);

    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connectWs = () => {
      if (closed) return;
      const ws = new WebSocket(liveSocketUrl());
      wsRef.current = ws;
      ws.onopen = () => setFeedStatus('live');
      ws.onmessage = (m) => { try { addEvents([JSON.parse(m.data) as IntelligenceEvent]); } catch (e) { console.error(e); } };
      ws.onclose = () => { setFeedStatus('offline'); if (!closed) retry = setTimeout(connectWs, 3000); };
    };
    connectWs();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setActiveGraphEntity(null); setSelection(null); setShowCopilot(false); setShowUpload(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      closed = true; if (retry) clearTimeout(retry); wsRef.current?.close();
      window.removeEventListener('keydown', onKey); clearInterval(countsTimer);
    };
  }, [addEvents, loadLayerCounts]);

  // Viewport-driven layers (watched entities, cameras).
  const refreshViewport = useCallback(() => {
    const q = bboxRef.current;
    if (layers.entities) loadStrategic(q);
    if (layers.cameras) loadCameras(q);
  }, [layers.entities, layers.cameras, loadStrategic, loadCameras]);

  const handleCameraMoveEnd = useCallback(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (viewer) {
      const rect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid, new Rectangle());
      if (rect) {
        const minLon = CesiumMath.toDegrees(rect.west), minLat = CesiumMath.toDegrees(rect.south);
        const maxLat = CesiumMath.toDegrees(rect.north);
        let maxLon = CesiumMath.toDegrees(rect.east);
        if (maxLon < minLon) maxLon += 360;
        bboxRef.current = `minLat=${minLat}&minLon=${minLon}&maxLat=${maxLat}&maxLon=${maxLon}`;
      }
    }
    refreshViewport();
  }, [refreshViewport]);

  useEffect(() => { const t = setTimeout(handleCameraMoveEnd, 1000); return () => clearTimeout(t); }, [handleCameraMoveEnd]);
  // Dev only: expose the viewer for console debugging.
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __pia_viewer?: CesiumViewer }).__pia_viewer = viewerRef.current?.cesiumElement;
  });
  useEffect(() => { refreshViewport(); loadLayerCounts(); }, [liveActive, refreshViewport, loadLayerCounts]);

  const flyTo = useCallback((lon: number, lat: number, height = 300000) => {
    viewerRef.current?.cesiumElement?.camera.flyTo({ destination: Cartesian3.fromDegrees(lon, lat, height), duration: 1.5 });
  }, []);

  const selectReport = useCallback((event: IntelligenceEvent, fly = true) => {
    if (fly && event.geo) flyTo(event.geo.lon, event.geo.lat, 400000);
    setSelection({ kind: 'report', event });
  }, [flyTo]);

  const selectCamera = useCallback((sensorId: string) => setSelection({ kind: 'camera', sensorId }), []);

  // Globe picking: cameras are billboards with a Sensor as id; reports/situations are entities.
  const handlePick = useCallback((movement: { position: Cartesian2 }) => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;
    const picked = viewer.scene.pick(movement.position);
    if (!picked) return;
    const id = picked.id;
    if (id && typeof id === 'object' && 'sensor_id' in id) { selectCamera((id as Sensor).sensor_id); return; }
    if (id instanceof CesiumEntity && typeof id.id === 'string') {
      if (id.id.startsWith('report:')) {
        const uid = id.id.slice(7);
        const ev = events.find(e => e.uid === uid);
        if (ev) selectReport(ev, false);
      }
    }
  }, [events, selectCamera, selectReport]);

  const toggleDomain = (d: string) => setActiveDomains(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);
  const toggleLayer = (id: LayerId) => setLayers(p => ({ ...p, [id]: !p[id] }));

  const filteredEvents = events.filter(e => activeDomains.includes(e.domain));
  const alertCount = filteredEvents.filter(e => e.priority === 'CRITICAL' || e.priority === 'HIGH').length;
  const selectedUid = selection?.kind === 'report' ? selection.event.uid : null;
  const inspectorOpen = selection !== null;

  return (
    <div className="h-screen w-screen bg-bg-0 text-text-1 flex flex-col overflow-hidden">
      <StatusBar feedStatus={feedStatus} alertCount={alertCount} onLiveChange={setLiveActive} />

      {/* Tool row: domain filter · entity search · actions. Fixed slot, never over the globe. */}
      <div className="h-9 flex items-center gap-3 px-3 bg-bg-1 border-b border-line">
        <FilterBar activeDomains={activeDomains} onToggleDomain={toggleDomain} />
        <div className="ml-auto flex items-center gap-2">
          <form onSubmit={(e) => {
            e.preventDefault();
            const input = (e.target as HTMLFormElement).elements.namedItem('entitySearch') as HTMLInputElement;
            if (input.value.trim()) { setActiveGraphEntity(input.value.trim()); input.value = ''; }
          }} className="relative">
            <input name="entitySearch" type="text" placeholder="Find entity…"
              className="bg-bg-0 border border-line text-text-1 px-2 py-1 pr-7 rounded font-mono text-[12px] w-56 focus:outline-none focus:border-accent" />
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-1"><Network size={13} /></button>
          </form>
          <button onClick={() => setShowUpload(v => !v)} title="Upload document"
            className={`p-1.5 rounded border ${showUpload ? 'border-accent text-text-1' : 'border-line text-text-2 hover:text-text-1'}`}><Upload size={14} /></button>
          <button onClick={() => setShowCopilot(v => !v)} title="Ask the assistant"
            className={`p-1.5 rounded border ${showCopilot ? 'border-accent text-text-1' : 'border-line text-text-2 hover:text-text-1'}`}><MessageSquare size={14} /></button>
          <a href="/archive" className="px-2 py-1 rounded border border-line font-mono text-[11px] text-text-2 hover:text-text-1 tracking-widest">ARCHIVE</a>
        </div>
      </div>

      {/* Main frame: rail · globe · inspector */}
      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: `300px 1fr ${inspectorOpen ? '380px' : '0px'}` }}>
        <aside className="min-h-0 flex flex-col bg-bg-1 border-r border-line">
          <LayerRail counts={layerCounts} enabled={layers} onToggle={toggleLayer} />
          <LiveTicker events={filteredEvents} selectedUid={selectedUid} onEventClick={(e) => selectReport(e)} />
        </aside>

        <main className="relative min-w-0 min-h-0">
          <Viewer
            ref={viewerRef}
            full={false}
            timeline={false} animation={false} baseLayerPicker={false} geocoder={false} homeButton={false}
            infoBox={false} selectionIndicator={false} navigationHelpButton={false} sceneModePicker={false}
            baseLayer={baseLayer}
            style={{ position: 'absolute', inset: 0 }}
          >
            <Camera onMoveEnd={handleCameraMoveEnd} />
            <ScreenSpaceEventHandler>
              <ScreenSpaceEvent action={handlePick as unknown as (e: unknown) => void} type={ScreenSpaceEventType.LEFT_CLICK} />
            </ScreenSpaceEventHandler>

            {/* Watched entities (hollow, dim) */}
            {layers.entities && (
              <PointPrimitiveCollection>
                {strategicEntities.map(en => en.geo && (
                  <PointPrimitive key={`en-${en.uid}`} position={Cartesian3.fromDegrees(en.geo.lon, en.geo.lat, 500)}
                    color={Color.fromCssColorString('rgba(59,130,246,0.35)')} outlineColor={Color.fromCssColorString('rgba(147,197,253,0.6)')}
                    outlineWidth={1} pixelSize={5} distanceDisplayCondition={new DistanceDisplayCondition(0, 12000000)} />
                ))}
              </PointPrimitiveCollection>
            )}

            {/* Cameras */}
            {layers.cameras && (
              <BillboardCollection>
                {cameras.map(c => (
                  <Billboard key={`cam-${c.sensor_id}`} id={c}
                    position={Cartesian3.fromDegrees(c.geo.lon, c.geo.lat, 30)}
                    image={c.status === 'ONLINE' ? CAMERA_ICONS.online : c.status === 'OFFLINE' ? CAMERA_ICONS.offline : CAMERA_ICONS.unknown}
                    scaleByDistance={new NearFarScalar(2000, 1.0, 3000000, 0.35)}
                    distanceDisplayCondition={new DistanceDisplayCondition(0, 4000000)}
                    disableDepthTestDistance={Number.POSITIVE_INFINITY} />
                ))}
              </BillboardCollection>
            )}

            {/* Situations (clusters) */}
            {layers.situations && clusters.filter(c => activeDomains.includes(c.domain)).map(c => {
              const hex = priorityHex(c.priority);
              const col = Color.fromCssColorString(hex);
              return (
                <Entity key={`cluster-${c.uid}`} id={`situation:${c.uid}`} position={Cartesian3.fromDegrees(c.lon, c.lat, 0)}>
                  <EllipseGraphics semiMajorAxis={50000} semiMinorAxis={50000} material={col.withAlpha(0.08)} outline outlineColor={col.withAlpha(0.45)} outlineWidth={1} height={0} />
                </Entity>
              );
            })}

            {/* Reports */}
            {layers.reports && filteredEvents.map(ev => ev.geo && (
              <Entity key={ev.uid} id={`report:${ev.uid}`} position={Cartesian3.fromDegrees(ev.geo.lon, ev.geo.lat, 1000)}>
                <PointGraphics
                  pixelSize={ev.priority === 'CRITICAL' ? 11 : ev.priority === 'HIGH' ? 9 : 6}
                  color={Color.fromCssColorString(priorityHex(ev.priority))}
                  outlineColor={Color.fromCssColorString('#07090c')} outlineWidth={1.5}
                  disableDepthTestDistance={Number.POSITIVE_INFINITY} />
                {(ev.priority === 'CRITICAL' || ev.priority === 'HIGH' || selectedUid === ev.uid) && (
                  <LabelGraphics
                    text={(ev.headline ?? '').slice(0, 48) + ((ev.headline?.length ?? 0) > 48 ? '…' : '')}
                    font="11px JetBrains Mono, monospace" fillColor={Color.fromCssColorString('#e6e9ed')}
                    style={LabelStyle.FILL_AND_OUTLINE} outlineColor={Color.fromCssColorString('#07090c')} outlineWidth={3}
                    showBackground backgroundColor={Color.fromCssColorString('rgba(11,14,18,0.85)')} backgroundPadding={new Cartesian2(6, 3)}
                    pixelOffset={new Cartesian2(0, -16)} distanceDisplayCondition={new DistanceDisplayCondition(0, 8000000)}
                    disableDepthTestDistance={Number.POSITIVE_INFINITY} />
                )}
              </Entity>
            ))}
          </Viewer>

          {/* Floating tools live inside the globe cell, so they can never cover the inspector. */}
          {showUpload && <div className="absolute top-3 right-3 z-20"><DocumentUploader onClose={() => setShowUpload(false)} /></div>}
          {showCopilot && <div className="absolute bottom-3 right-3 z-20"><AICopilot onClose={() => setShowCopilot(false)} /></div>}
          {activeGraphEntity && <RelationalWeb entityName={activeGraphEntity} onClose={() => setActiveGraphEntity(null)} />}
        </main>

        <aside className={`min-h-0 bg-bg-1 border-l border-line overflow-hidden ${inspectorOpen ? '' : 'hidden'}`}>
          {selection?.kind === 'report' && (
            <EntityDossier event={selection.event} onClose={() => setSelection(null)}
              onOpenGraph={(n) => setActiveGraphEntity(n)} onOpenCamera={selectCamera} />
          )}
          {selection?.kind === 'camera' && <CameraInspector sensorId={selection.sensorId} onClose={() => setSelection(null)} />}
        </aside>
      </div>

      <TerminalLog />
    </div>
  );
}

export default Dashboard;
