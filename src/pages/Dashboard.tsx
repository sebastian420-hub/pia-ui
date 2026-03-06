import { useEffect, useState, useRef, useCallback } from 'react';
import { Viewer, Entity, PointGraphics, EntityDescription } from 'resium';
import { Cartesian3, Color } from 'cesium';
import LiveTicker from '../components/hud/LiveTicker';
import type { IntelligenceEvent } from '../components/hud/LiveTicker';
import RelationalWeb from '../components/hud/RelationalWeb';
import FilterBar from '../components/hud/FilterBar';
import EntityDossier from '../components/hud/EntityDossier';
import TerminalLog from '../components/hud/TerminalLog';
import { Network } from 'lucide-react';
import './Dashboard.css';

function Dashboard() {
  const [events, setEvents] = useState<IntelligenceEvent[]>([]);
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
            </Entity>
          );
        })}
      </Viewer>

      {/* HUD Layer: Top Filter Bar */}
      <FilterBar activeDomains={activeDomains} onToggleDomain={toggleDomain} />

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

      {/* HUD Layer: Bottom Terminal Log */}
      <TerminalLog />

    </div>
  );
}

export default Dashboard;