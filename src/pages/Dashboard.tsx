import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Viewer, Camera, ScreenSpaceEventHandler, ScreenSpaceEvent } from 'resium';
import type { CesiumComponentRef } from 'resium';
import {
  Cartesian3, Cartesian2, Math as CesiumMath, Rectangle,
  Viewer as CesiumViewer, Ion, ScreenSpaceEventType,
  Entity as CesiumEntity,
} from 'cesium';
import { CameraLayer, WatchedEntityLayer, EventLayer, SituationLayer, ReportLayer } from '../components/globe/layers';
import type { ClusterData } from '../components/globe/layers';
import { Upload, MessageSquare } from 'lucide-react';
import { BasemapSwitcher } from '../components/globe/BasemapSwitcher';
import { BASEMAPS, DEFAULT_BASEMAP } from '../lib/basemaps';
import type { BasemapId } from '../lib/basemaps';
import StatusBar from '../components/frame/StatusBar';
import LayerRail from '../components/frame/LayerRail';
import type { LayerId } from '../components/frame/LayerRail';
import { Network as NetworkIcon } from 'lucide-react';
import LiveTicker from '../components/hud/LiveTicker';
import WebView from '../components/hud/WebView';
import EntityInspector from '../components/hud/EntityInspector';
import FilterBar from '../components/hud/FilterBar';
import EntityDossier from '../components/hud/EntityDossier';
import CameraInspector from '../components/hud/CameraInspector';
import TerminalLog from '../components/hud/TerminalLog';
import AICopilot from '../components/hud/AICopilot';
import DocumentUploader from '../components/hud/DocumentUploader';
import type { IntelligenceEvent, ClusterRow, ArchiveRecord, LayerCount, Sensor, Selection, KgEvent, EntitySummary } from '../lib/types';
import { apiFetch, liveSocketUrl } from '../lib/api';
import { DOMAINS } from '../lib/domains';

const MAX_EVENTS = 400;

/** Cesium's default imagery needs an ion token; the default here is a token-free dark basemap. */
const ionToken: string = import.meta.env.VITE_CESIUM_ION_TOKEN ?? '';
if (ionToken) Ion.defaultAccessToken = ionToken;

function archiveToEvent(r: ArchiveRecord): IntelligenceEvent {
  return { uid: r.uid, source_type: r.source_type, priority: r.priority, domain: r.domain, headline: r.content_headline, created_at: r.created_at, geo: r.geo ?? null };
}

function Dashboard() {
  const [events, setEvents] = useState<IntelligenceEvent[]>([]);
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const [strategicEntities, setStrategicEntities] = useState<IntelligenceEvent[]>([]);
  const [cameras, setCameras] = useState<Sensor[]>([]);
  const [layerCounts, setLayerCounts] = useState<LayerCount[]>([]);
  const [layers, setLayers] = useState<Record<LayerId, boolean>>({ reports: true, entities: true, situations: true, cameras: true, events: true });
  const [kgEvents, setKgEvents] = useState<KgEvent[]>([]);
  const [searchHits, setSearchHits] = useState<EntitySummary[]>([]);
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


  // ── Basemap switcher ─────────────────────────────────────────────────────
  const [basemapId, setBasemapId] = useState<BasemapId>(DEFAULT_BASEMAP);

  /** Initial layer passed to <Viewer>; subsequent swaps go through the effect below. */
  const baseLayer = useMemo(() => {
    if (ionToken) return undefined; // let Ion handle imagery
    return BASEMAPS.find(b => b.id === basemapId)?.layer() ?? BASEMAPS[0].layer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — only used for the initial mount

  /** Swap the basemap layer whenever the user picks a new style. */
  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer || ionToken) return;
    const def = BASEMAPS.find(b => b.id === basemapId);
    if (!def) return;
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.add(def.layer());
  }, [basemapId]);



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

  const loadEvents = useCallback(() => {
    const from = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    apiFetch<KgEvent[]>(`/api/v1/kg/events?from=${encodeURIComponent(from)}&limit=800`).then(r => {
      if (r.status === 'success' && r.data) setKgEvents(r.data.filter(e => e.geo));
    });
  }, []);

  // Debounced, and stale responses are dropped so fast typing cannot show results for an older prefix.
  const searchSeq = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchEntities = useCallback((q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchHits([]); return; }
    searchTimer.current = setTimeout(async () => {
      const seq = ++searchSeq.current;
      const r = await apiFetch<EntitySummary[]>(`/api/v1/kg/search?q=${encodeURIComponent(q.trim())}&limit=8`);
      if (seq !== searchSeq.current) return;
      setSearchHits(r.status === 'success' && r.data ? r.data : []);
    }, 180);
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
    loadEvents();
    const countsTimer = setInterval(() => { loadLayerCounts(); loadEvents(); }, 60000);

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
      if (e.key === 'Escape') { setActiveGraphEntity(null); setSelection(null); setShowCopilot(false); setShowUpload(false); setSearchHits([]); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      closed = true; if (retry) clearTimeout(retry); wsRef.current?.close();
      window.removeEventListener('keydown', onKey); clearInterval(countsTimer);
    };
  }, [addEvents, loadLayerCounts, loadEvents]);

  // Viewport-driven layers (watched entities, cameras).
  const refreshViewport = useCallback(() => {
    const q = bboxRef.current;
    if (layers.entities) loadStrategic(q);
    if (layers.cameras) loadCameras(q);
  }, [layers.entities, layers.cameras, loadStrategic, loadCameras]);

  const handleCameraMoveEnd = useCallback(() => {
    let viewer: CesiumViewer | undefined;
    try { viewer = viewerRef.current?.cesiumElement; } catch { viewer = undefined; }
    if (viewer && !viewer.isDestroyed()) {
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
  const selectEntity = useCallback((key: string) => { setSelection({ kind: 'entity', key }); setSearchHits([]); }, []);
  const openReportByUid = useCallback(async (uid: string) => {
    const known = events.find(e => e.uid === uid);
    if (known) { selectReport(known); return; }
    const r = await apiFetch<{ uid: string; created_at: string; source_type: string; priority: string; domain: string; content_headline: string; geo: { lat: number; lon: number } | null }>(`/api/v1/reports/${uid}`);
    if (r.status === 'success' && r.data) {
      const d = r.data;
      selectReport({ uid: d.uid, created_at: d.created_at, source_type: d.source_type, priority: d.priority, domain: d.domain, headline: d.content_headline, geo: d.geo });
    }
  }, [events, selectReport]);

  // Globe picking: cameras are billboards with a Sensor as id; reports/situations are entities.
  const handlePick = useCallback((movement: { position: Cartesian2 }) => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;
    const picked = viewer.scene.pick(movement.position);
    if (!picked) return;
    const id = picked.id;
    if (id && typeof id === 'object' && 'sensor_id' in id) { selectCamera((id as Sensor).sensor_id); return; }
    if (id && typeof id === 'object' && 'event_id' in id) {
      const ev = id as KgEvent;
      if (ev.report_uid) openReportByUid(ev.report_uid);
      else if (ev.actor_qid) selectEntity(ev.actor_qid);
      return;
    }
    if (id instanceof CesiumEntity && typeof id.id === 'string') {
      if (id.id.startsWith('report:')) {
        const uid = id.id.slice(7);
        const ev = events.find(e => e.uid === uid);
        if (ev) selectReport(ev, false);
      }
    }
  }, [events, selectCamera, selectReport, openReportByUid, selectEntity]);

  const toggleDomain = (d: string) => setActiveDomains(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);
  const toggleLayer = (id: LayerId) => setLayers(p => ({ ...p, [id]: !p[id] }));

  const filteredEvents = useMemo(() => events.filter(e => activeDomains.includes(e.domain)), [events, activeDomains]);
  const visibleClusters = useMemo(() => clusters.filter(c => activeDomains.includes(c.domain)), [clusters, activeDomains]);
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
            if (searchHits[0]) { selectEntity(searchHits[0].entity_id); input.value = ''; }
            else if (input.value.trim()) { selectEntity(input.value.trim()); input.value = ''; }
          }} className="relative">
            <input name="entitySearch" type="text" placeholder="Find entity (who is who)…" autoComplete="off"
              onChange={(e) => searchEntities(e.target.value)}
              className="bg-bg-0 border border-line text-text-1 px-2 py-1 pr-7 rounded font-mono text-[12px] w-64 focus:outline-none focus:border-accent" />
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-1"><NetworkIcon size={13} /></button>
            {searchHits.length > 0 && (
              <ul className="absolute top-full mt-1 left-0 w-80 bg-bg-1 border border-line rounded shadow-xl z-50 font-mono text-[12px]">
                {searchHits.map(h => (
                  <li key={h.entity_id}>
                    <button type="button" onClick={() => selectEntity(h.entity_id)} className="w-full text-left px-2 py-1 hover:bg-bg-2 flex items-center justify-between gap-2">
                      <span className="truncate text-text-1">{h.name}</span>
                      <span className="text-text-3 shrink-0">{h.kind}{h.qid ? ` · ${h.qid}` : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>
          <button onClick={() => setShowUpload(v => !v)} title="Upload document"
            className={`p-1.5 rounded border ${showUpload ? 'border-accent text-text-1' : 'border-line text-text-2 hover:text-text-1'}`}><Upload size={14} /></button>
          <button onClick={() => setShowCopilot(v => !v)} title="Ask the assistant"
            className={`p-1.5 rounded border ${showCopilot ? 'border-accent text-text-1' : 'border-line text-text-2 hover:text-text-1'}`}><MessageSquare size={14} /></button>
          <a href="/archive" className="px-2 py-1 rounded border border-line font-mono text-[11px] text-text-2 hover:text-text-1 tracking-widest">ARCHIVE</a>
          <a href="/review" className="px-2 py-1 rounded border border-line font-mono text-[11px] text-text-2 hover:text-text-1 tracking-widest" title="Names the resolver was not sure about">REVIEW</a>
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

            {layers.entities && <WatchedEntityLayer entities={strategicEntities} />}
            {layers.cameras && <CameraLayer cameras={cameras} />}
            {layers.events && <EventLayer events={kgEvents} />}
            {layers.situations && <SituationLayer clusters={visibleClusters} />}
            {layers.reports && <ReportLayer reports={filteredEvents} selectedUid={selectedUid} />}
          </Viewer>

          {/* Floating tools live inside the globe cell, so they can never cover the inspector. */}
          <BasemapSwitcher current={basemapId} onChange={setBasemapId} />
          {showUpload && <div className="absolute top-3 right-3 z-20"><DocumentUploader onClose={() => setShowUpload(false)} /></div>}
          {showCopilot && <div className="absolute bottom-3 right-3 z-20"><AICopilot onClose={() => setShowCopilot(false)} /></div>}
          {activeGraphEntity && <WebView entityKey={activeGraphEntity} onClose={() => setActiveGraphEntity(null)} onOpenEntity={(k) => { setActiveGraphEntity(null); selectEntity(k); }} />}
        </main>

        <aside className={`min-h-0 bg-bg-1 border-l border-line overflow-hidden ${inspectorOpen ? '' : 'hidden'}`}>
          {selection?.kind === 'report' && (
            <EntityDossier event={selection.event} onClose={() => setSelection(null)}
              onOpenGraph={(n) => selectEntity(n)} onOpenCamera={selectCamera} />
          )}
          {selection?.kind === 'entity' && (
            <EntityInspector entityKey={selection.key} onClose={() => setSelection(null)}
              onOpenEntity={selectEntity} onOpenReport={openReportByUid}
              onOpenWeb={(k) => setActiveGraphEntity(k)} onFlyTo={(lon, lat) => flyTo(lon, lat, 800000)} />
          )}
          {selection?.kind === 'camera' && <CameraInspector sensorId={selection.sensorId} onClose={() => setSelection(null)} />}
        </aside>
      </div>

      <TerminalLog />
    </div>
  );
}

export default Dashboard;
