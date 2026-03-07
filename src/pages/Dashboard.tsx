import { useEffect, useState, useRef, useCallback } from 'react';
import { Viewer, Camera, Entity, PointGraphics, LabelGraphics, EntityDescription, PointPrimitiveCollection, PointPrimitive } from 'resium';
import { Cartesian3, Cartesian2, Color, DistanceDisplayCondition, LabelStyle, Math as CesiumMath, Rectangle } from 'cesium';
import LiveTicker from '../components/hud/LiveTicker';
import type { IntelligenceEvent } from '../components/hud/LiveTicker';
import RelationalWeb from '../components/hud/RelationalWeb';
import FilterBar from '../components/hud/FilterBar';
import EntityDossier from '../components/hud/EntityDossier';
import TerminalLog from '../components/hud/TerminalLog';
import AICopilot from '../components/hud/AICopilot';
import { Network } from 'lucide-react';
import './Dashboard.css';

function Dashboard() {
  const [events, setEvents] = useState<IntelligenceEvent[]>([]);
  const [strategicEntities, setStrategicEntities] = useState<IntelligenceEvent[]>([]);
  const [activeGraphEntity, setActiveGraphEntity] = useState<string | null>(null);
  const [activeDomains, setActiveDomains] = useState<string[]>(['MILITARY', 'POLITICAL', 'NATURAL', 'CYBER', 'FINANCE', 'UNKNOWN']);
  const [activeDossierEvent, setActiveDossierEvent] = useState<IntelligenceEvent | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    // 1. Fetch existing clusters on load
    fetch('http://localhost:8001/api/v1/clusters/active')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success' && data.data) {
          const formatted = data.data.map((c: any) => ({
            uid: c.cluster_id,
            priority: c.priority || 'NORMAL',
            domain: c.domain || 'UNKNOWN',
            headline: c.title || c.name || 'Unknown Event',
            source_type: 'SYSTEM',
            geo: { lat: c.lat, lon: c.lon }
          })).filter((c: any) => c.geo.lat && c.geo.lon);
          setEvents(formatted);
        }
      })
      .catch(err => console.error("Failed to fetch initial clusters:", err));

    // 2. Connect to the FastAPI WebSocket
    const connectWs = () => {
      const ws = new WebSocket('ws://localhost:8001/ws/live');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to SENTINEL Live Feed');
      };

      ws.onmessage = (message) => {
        try {
          const data: IntelligenceEvent = JSON.parse(message.data);
          console.log('New Intelligence Received:', data);
          
          if (data.geo && data.geo.lat && data.geo.lon) {
            setEvents((prev) => {
              if (prev.some(e => e.uid === data.uid)) return prev;
              const updated = [...prev, data];
              if (updated.length > 200) return updated.slice(updated.length - 200);
              return updated;
            });
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message', e);
        }
      };

      ws.onclose = () => {
        console.log('Disconnected from SENTINEL Live Feed, attempting reconnect...');
        setTimeout(connectWs, 3000);
      };
    };

    connectWs();

    // Global Key Listener for ESC to close graph
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveGraphEntity(null);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (wsRef.current) wsRef.current.close();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleCameraMoveEnd = useCallback(() => {
    if (!viewerRef.current || !viewerRef.current.cesiumElement) return;
    const viewer = viewerRef.current.cesiumElement;
    const camera = viewer.camera;
    const ellipsoid = viewer.scene.globe.ellipsoid;
    
    // Compute view rectangle. This can sometimes be undefined if looking off into space.
    const rect = camera.computeViewRectangle(ellipsoid, new Rectangle());
    if (rect) {
      let minLon = CesiumMath.toDegrees(rect.west);
      let minLat = CesiumMath.toDegrees(rect.south);
      let maxLon = CesiumMath.toDegrees(rect.east);
      let maxLat = CesiumMath.toDegrees(rect.north);

      // Simple handling for crossing the antimeridian
      if (maxLon < minLon) {
        maxLon += 360;
      }

      fetch(`http://localhost:8001/api/v1/entities/bbox?minLat=${minLat}&minLon=${minLon}&maxLat=${maxLat}&maxLon=${maxLon}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success' && data.data) {
            setStrategicEntities(data.data);
          }
        })
        .catch(err => console.error("Failed to fetch bbox entities:", err));
    }
  }, []);

  // Run initial bounding box fetch shortly after mount once viewer is ready
  useEffect(() => {
    const timer = setTimeout(() => {
      handleCameraMoveEnd();
    }, 1000);
    return () => clearTimeout(timer);
  }, [handleCameraMoveEnd]);

  const getPriorityColor = (priority: string) => {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL': return Color.RED;
      case 'HIGH': return Color.ORANGE;
      case 'NORMAL': return Color.YELLOW;
      default: return Color.BLUE;
    }
  };

  const handleEventClick = useCallback((event: IntelligenceEvent) => {
    // 1. Fly camera
    if (event.geo && viewerRef.current && viewerRef.current.cesiumElement) {
      const viewer = viewerRef.current.cesiumElement;
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(event.geo.lon, event.geo.lat, 500000), // Fly to 500km altitude
        duration: 2.0 // 2 second flight
      });
    }
    // 2. Open Dossier
    setActiveDossierEvent(event);
  }, []);

  const toggleDomain = (domain: string) => {
    setActiveDomains(prev => 
      prev.includes(domain) 
        ? prev.filter(d => d !== domain)
        : [...prev, domain]
    );
  };

  // Filter the events before passing them to the globe and ticker
  const filteredEvents = events.filter(e => activeDomains.includes(e.domain));

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      
      {/* 3D Globe Layer */}
      <Viewer 
        ref={viewerRef}
        full
        timeline={false} 
        animation={false}
        baseLayerPicker={false}
        geocoder={false}
        homeButton={false}
        infoBox={true}
        navigationHelpButton={false}
        sceneModePicker={false}
        className="absolute inset-0 z-0"
      >
        <Camera onMoveEnd={handleCameraMoveEnd} />

        {/* Static Test Marker to ensure rendering works */}
        <Entity
          name="Static Test Marker (New York)"
          position={Cartesian3.fromDegrees(-74.0060, 40.7128, 10000)}
        >
          <PointGraphics pixelSize={20} color={Color.LIME} outlineColor={Color.WHITE} outlineWidth={2} />
          <EntityDescription>
            <div><p>If you see this, Resium markers are working.</p></div>
          </EntityDescription>
        </Entity>

        {/* Knowledge Underlay Layer (High Performance Primitives) */}
        <PointPrimitiveCollection>
          {strategicEntities.map((entity) => {
            if (!entity.geo) return null;
            const position = Cartesian3.fromDegrees(entity.geo.lon, entity.geo.lat, 1000);
            return (
              <PointPrimitive
                key={`strategic-point-${entity.uid}`}
                position={position}
                color={Color.fromCssColorString('rgba(0, 102, 255, 0.4)')}
                outlineColor={Color.fromCssColorString('rgba(255, 255, 255, 0.1)')}
                outlineWidth={1}
                pixelSize={5}
                distanceDisplayCondition={new DistanceDisplayCondition(0, 10000000)}
              />
            );
          })}
        </PointPrimitiveCollection>

        {/* Mapped standard Entities for labels, but fewer of them and only for top threats */}
        {strategicEntities.filter(e => e.priority === 'CRITICAL' || e.priority === 'HIGH').map((entity) => {
          if (!entity.geo) return null;
          const position = Cartesian3.fromDegrees(entity.geo.lon, entity.geo.lat, 1000);
          
          return (
            <Entity
              key={`strategic-label-${entity.uid}`}
              name={entity.headline}
              position={position}
            >
              <LabelGraphics
                text={`[ ${entity.headline} ]`}
                font="bold 10px monospace"
                fillColor={Color.fromCssColorString('rgba(255, 255, 255, 0.7)')}
                style={LabelStyle.FILL_AND_OUTLINE}
                outlineColor={Color.BLACK}
                outlineWidth={2}
                showBackground={true}
                backgroundColor={Color.fromCssColorString('rgba(0, 0, 0, 0.6)')}
                backgroundPadding={new Cartesian2(6, 4)}
                pixelOffset={new Cartesian2(0, -10)}
                distanceDisplayCondition={new DistanceDisplayCondition(0, 3000000)}
              />
              <EntityDescription>
                <div>
                  <p className="text-white/50 text-xs tracking-widest mb-2 border-b border-white/10">KNOWLEDGE UNDERLAY</p>
                  <p><strong>Entity:</strong> {entity.headline}</p>
                  <p><strong>Type:</strong> {entity.domain}</p>
                  <p className="mt-2 text-xs italic">Permanently tracked strategic entity.</p>
                </div>
              </EntityDescription>
            </Entity>
          );
        })}

        {/* Live Intelligence Layer (Bright) */}
        {filteredEvents.map((event) => {
          if (!event.geo) return null;
          const position = Cartesian3.fromDegrees(event.geo.lon, event.geo.lat, 10000);
          
          return (
            <Entity
              key={event.uid}
              name={event.headline}
              position={position}
            >
              <PointGraphics 
                pixelSize={event.priority === 'CRITICAL' ? 20 : 15} 
                color={getPriorityColor(event.priority)}
                outlineColor={Color.WHITE}
                outlineWidth={2}
              />
              <LabelGraphics
                text={event.headline?.substring(0, 30) + (event.headline && event.headline.length > 30 ? '...' : '')}
                font="bold 12px monospace"
                fillColor={Color.WHITE}
                style={LabelStyle.FILL_AND_OUTLINE}
                outlineColor={Color.BLACK}
                outlineWidth={3}
                showBackground={true}
                backgroundColor={new Color(0.02, 0.02, 0.02, 0.8)}
                backgroundPadding={new Cartesian2(7, 5)}
                pixelOffset={new Cartesian2(0, -25)}
                distanceDisplayCondition={new DistanceDisplayCondition(0, 6000000)}
              />
            </Entity>
          );
        })}
      </Viewer>

      {/* HUD Layer: Top Filter Bar */}
      <FilterBar activeDomains={activeDomains} onToggleDomain={toggleDomain} />

      {/* HUD Layer: Top Right Controls (Search & Archive) */}
      <div className="absolute top-4 right-4 z-20 flex gap-2">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const input = form.elements.namedItem('entitySearch') as HTMLInputElement;
            if (input.value.trim()) {
              setActiveGraphEntity(input.value.trim());
              input.value = '';
            }
          }}
          className="relative"
        >
          <input 
            name="entitySearch"
            type="text" 
            placeholder="Search Graph Entity..." 
            className="bg-black/80 backdrop-blur border border-sentinel-blue/50 text-white px-4 py-2 pr-10 rounded font-mono text-sm focus:outline-none focus:border-sentinel-blue transition-colors shadow-[0_0_15px_rgba(0,102,255,0.2)]"
          />
          <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-sentinel-blue hover:text-white">
            <Network size={16} />
          </button>
        </form>
        <button 
          onClick={() => window.location.href = '/archive'}
          className="bg-black/80 backdrop-blur border border-white/20 text-white px-4 py-2 rounded font-mono text-sm hover:bg-white/10 transition-colors"
        >
          ARCHIVE
        </button>
      </div>

      {/* HUD Layer: Left Sidebar Ticker */}
      <LiveTicker events={filteredEvents} onEventClick={handleEventClick} />
      
      {/* HUD Layer: Right Sidebar Dossier */}
      <EntityDossier 
        event={activeDossierEvent} 
        onClose={() => setActiveDossierEvent(null)} 
        onOpenGraph={(entityName) => setActiveGraphEntity(entityName)} 
      />

      {/* Relational Web Overlay (Z-40) */}
      {activeGraphEntity && (
        <RelationalWeb 
          entityName={activeGraphEntity} 
          onClose={() => setActiveGraphEntity(null)} 
        />
      )}

      {/* HUD Layer: AI Co-Pilot Chat */}
      <AICopilot />

      {/* HUD Layer: Bottom Terminal Log */}
      <TerminalLog />

    </div>
  );
}

export default Dashboard;
