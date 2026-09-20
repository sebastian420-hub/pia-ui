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
  | { kind: 'entity'; key: string }
  | { kind: 'evidence'; a: string; b: string }
  | null;

// ── knowledge web ───────────────────────────────────────────────────────────

export type EntityKind = 'PERSON' | 'ORG' | 'COUNTRY' | 'PLACE' | 'VESSEL' | 'AIRCRAFT' | 'EVENT' | 'UNKNOWN';
export type RelationKind = 'HOSTILE' | 'COOPERATIVE' | 'ROLE' | 'OWNERSHIP' | 'MEMBERSHIP' | 'LOCATED' | 'MENTIONED_WITH';

export interface EntitySummary {
  entity_id: string;
  qid: string | null;
  kind: EntityKind;
  name: string;
  description: string | null;
  resolution: string;
  origin: string;
  country_qid: string | null;
  sitelinks: number;
  mention_count: number;
  first_seen: string | null;
  last_seen: string | null;
  geo: GeoPoint | null;
  score?: number;
}

export interface TopicCount { topic: string; count: number }

/** The words and the quote a connection rests on (its strongest verified event). */
export interface Why {
  predicate: string; quote: string | null; modality: string | null; verdict: 'yes' | 'partly' | 'no' | null;
  outlet?: string | null; when?: string | null; outgoing?: boolean; actor_id?: string;
}

export interface Listing { list: string; program?: string | null; since?: string | null; until?: string | null; url?: string | null }

export interface RelationEntry {
  sources?: string[];
  actions?: string[];
  why?: Why | null;
  via_source?: string | null;     // connector facts: which source said it
  record_ref?: string | null;
  properties?: Record<string, unknown> | null;
  topics?: TopicCount[];
  verified_topics?: TopicCount[];
  verified_count?: number;   // events an article said (origin llm, with a quote)
  wire_count?: number;       // GDELT story-days behind the pair
  entity_id: string;
  qid: string | null;
  name: string;
  kind: EntityKind;
  label: string | null;
  source: 'events' | 'wikidata' | 'cooccurrence' | 'connector';
  event_count: number;
  weight: number;
  first_seen: string | null;
  last_seen: string | null;
  direction: 'in' | 'out' | null;
}

export interface EntityCard extends EntitySummary {
  aliases: { alias: string; source: string }[];
  trend: { last_7d: number; prev_7d: number } | null;
  relations: Partial<Record<RelationKind, RelationEntry[]>>;
  brief?: { text: string; generated_at: string } | null;
  listings?: Listing[];
  properties?: Record<string, unknown>;
  external_ids?: { source_id: string; external_id: string; kind: string }[];
  timeline?: { event_id: string; event_time: string; kind: string | null; stance: number | null; modality: string | null;
               verifier_verdict: string | null; predicate: string; actor: string; target: string | null; quote: string | null;
               source_id: string | null; origin: string }[];
  event_counts: Record<string, number>;
  recent_reports: { report_uid: string; role: string; surface: string; content_headline: string; created_at: string; source_id: string; priority: string }[];
  wikidata_url: string | null;
}

export interface KgEvent {
  event_id: string;
  event_time: string;
  time_precision?: string;
  action: string;
  kind?: string | null;
  topic?: string | null;
  code?: string | null;
  coded_as?: string | null;
  outlets?: string[] | null;
  predicate?: string | null;
  stance?: number | null;
  modality?: string | null;
  polarity?: boolean | null;
  verifier_verdict?: 'yes' | 'partly' | 'no' | null;
  verifier_note?: string | null;
  confidence: number;
  tone: number | null;
  quote: string | null;
  origin: string;
  source_id: string | null;
  report_uid: string | null;
  content_headline: string | null;
  actor: string | null; actor_qid?: string | null;
  target: string | null; target_qid?: string | null;
  location: string | null;
  geo: GeoPoint | null;
}

export interface RelationEvidence {
  a: EntitySummary; b: EntitySummary;
  relations: { kind: RelationKind; source: string; label: string | null; event_count: number; weight: number; first_seen: string | null; last_seen: string | null; topics?: TopicCount[]; verified_topics?: TopicCount[]; verified_count?: number; wire_count?: number }[];
  events: (KgEvent & { source_url?: string | null })[];
  shared_reports: { uid: string; content_headline: string; created_at: string; source_id: string }[];
}

export interface ReviewItem {
  entity_id: string;
  name: string;
  kind: EntityKind;
  mentions: number;
  created_at: string;
  note: string | null;
  candidates: { qid: string; name?: string; kind?: string; description?: string | null }[];
  examples: { report_uid: string; surface: string; headline: string }[];
}

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
  qid?: string | null;
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
  qid?: string | null;
  name: string;
  group: string;
  val: number;
  mentions?: number;
  is_root?: boolean;
  description?: string | null;
  x?: number; y?: number; z?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  label: string;
  confidence: number;
  kind?: RelationKind;
  origin?: 'events' | 'wikidata' | 'cooccurrence' | 'connector';
  via_source?: string | null;
  event_count?: number;
  weight?: number;
  outlets?: string[];
  topics?: TopicCount[];
  verified_topics?: TopicCount[];
  verified_count?: number;
  wire_count?: number;
  why?: Why | null;
  first_seen?: string | null;
  last_seen?: string | null;
  reasoning?: string | null;
}

export interface GraphData { root?: string; nodes: GraphNode[]; links: GraphLink[] }

/** GET /kg/web/overview — the web from far away, for the globe. */
export interface WebOverviewNode {
  id: string; qid: string | null; name: string; kind: EntityKind;
  lat: number | null; lon: number | null; orbits: boolean; country_id: string | null; activity: number;
}
export interface WebOverviewLink {
  source: string; target: string; event_count: number; hostile_n: number; coop_n: number;
  verified_count: number; wire_count: number; v_hostile_n: number; v_coop_n: number;
  kind: 'HOSTILE' | 'COOPERATIVE'; topics: TopicCount[]; outlets: string[]; last_seen: string | null;
}
export interface WebOverview { window: '24h' | '7d' | '30d' | '90d'; nodes: WebOverviewNode[]; links: WebOverviewLink[] }
export type WebWindow = WebOverview['window'];
