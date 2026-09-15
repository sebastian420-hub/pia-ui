export interface GeoPoint { lat: number; lon: number }

export interface IntelligenceEvent {
  uid: string;
  source_type?: string;
  priority: string;
  domain: string;
  headline?: string;
  name?: string;
  created_at?: string | null;
  geo: GeoPoint | null;
}

export interface LayerCount { layer_id: string; label: string; count: number }

export interface Sensor {
  sensor_id: string;
  provider: string;
  name: string | null;
  city: string | null;
  country_code: string | null;
  media_kind: 'SNAPSHOT' | 'HLS' | 'MP4' | 'MJPEG';
  has_video: boolean;
  refresh_seconds: number;
  cost_class: 'FREE' | 'ON_DEMAND' | 'SUBSCRIPTION';
  requires_relay: boolean;
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  last_ok: string | null;
  geo: GeoPoint;
  attribution?: string;
  external_id?: string;
  first_seen?: string;
  last_seen?: string | null;
  metadata?: Record<string, unknown> | null;
  snapshot_url?: string;
  video_proxy_url?: string | null;
}

export interface LiveSession { session_id: string; started_at: string; expires_at: string; note: string | null }

export interface LiveStatus {
  active: boolean;
  session: LiveSession | null;
  relay_configured: boolean;
  minutes_used_today: number;
  estimated_cost_today_usd: number;
}

export interface HealthAgent { agent_name: string; agent_kind: string; status: string; age_seconds: number; alive: boolean }

export interface Health {
  agents: HealthAgent[];
  agents_alive: number;
  agents_total: number;
  queue: Record<string, number>;
  last_record_age_seconds: number | null;
  cameras: { online: number; offline: number; total: number } | null;
  live_session: LiveSession | null;
  server_time: string;
}

export type Selection =
  | { kind: 'report'; event: IntelligenceEvent }
  | { kind: 'camera'; sensorId: string }
  | null;

export interface ClusterRow {
  cluster_id: string;
  name?: string;
  priority?: string;
  domain?: string;
  lat: number | null;
  lon: number | null;
}

export interface ArchiveRecord {
  uid: string;
  created_at: string | null;
  source_type: string;
  priority: string;
  domain: string;
  content_headline: string;
  content_summary: string | null;
  entities?: string[];
  similarity?: number;
  geo?: GeoPoint | null;
}

export interface GraphNode {
  id: string;
  name: string;
  group: string;
  val: number;
  description?: string;
  x?: number; y?: number; z?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  label: string;
  confidence: number;
  reasoning?: string | null;
  relationships?: { relationship_id: string; type: string }[];
}

export interface GraphData { nodes: GraphNode[]; links: GraphLink[] }
