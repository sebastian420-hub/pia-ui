/**
 * The wheel: one entity in the centre, its partners on a ring at fixed angles.
 *
 *   hostile      left    (150° … 210°)
 *   cooperative  right   (−30° … 30°)
 *   role / ownership     bottom (60° … 120°)
 *   facts (membership / located / mentioned_with)   top (240° … 300°)
 *
 * Sector widths grow with the number of partners (a country with 40 cooperative and 2 hostile
 * partners gets a wide right side and a narrow left side), but every sector keeps at least
 * MIN_SPAN degrees and its axis. Inside a sector the strongest partner sits nearest the axis;
 * when a ring is full the rest go to an outer ring. A pair with both a hostile and a
 * cooperative relation goes to the side with more events. Pure: no DOM, no physics.
 * Angles are in screen space (y grows downwards), so 90° is "below" the centre.
 */
import type { GraphLink, GraphNode, RelationKind } from '../../lib/types';

export interface WheelPos { x: number; y: number; angle: number; ring: number; sector: Sector }
export type Sector = 'hostile' | 'cooperative' | 'role' | 'facts';

/** Nominal sectors (used when partners are evenly spread) and their axes. */
export const SECTORS: Record<Sector, { from: number; to: number }> = {
  cooperative: { from: -30, to: 30 },
  role: { from: 60, to: 120 },
  hostile: { from: 150, to: 210 },
  facts: { from: 240, to: 300 },
};
const AXIS: Record<Sector, number> = { cooperative: 0, role: 90, hostile: 180, facts: 270 };
export const RING_RADIUS = 260;
export const RING_STEP = 110;
export const RING_CAPACITY = 14;   // for a nominal 60° sector; wider sectors hold proportionally more
export const MIN_SPAN = 24;         // degrees; an empty sector still leaves a gap
const MAX_SPAN = 250;
const DEG_PER_SLOT = 60 / RING_CAPACITY;   // ≈ 4.3°: radial labels at radius 260 are ~20 px apart

/** Angular span per sector, proportional to its partner count, summing to ≤ 360. */
export function sectorSpans(counts: Record<Sector, number>): Record<Sector, { from: number; to: number }> {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const raw = {} as Record<Sector, number>;
  (Object.keys(AXIS) as Sector[]).forEach(s => {
    raw[s] = Math.min(MAX_SPAN, Math.max(MIN_SPAN, (counts[s] / total) * 360));
  });
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  const k = sum > 360 ? 360 / sum : 1;
  const out = {} as Record<Sector, { from: number; to: number }>;
  (Object.keys(AXIS) as Sector[]).forEach(s => {
    const half = (raw[s] * k) / 2;
    out[s] = { from: AXIS[s] - half, to: AXIS[s] + half };
  });
  return out;
}

const idOf = (x: string | GraphNode): string => (typeof x === 'object' ? String(x.id) : String(x));

export function sectorOfKind(kind: RelationKind | undefined): Sector {
  switch (kind) {
    case 'HOSTILE': return 'hostile';
    case 'COOPERATIVE': return 'cooperative';
    case 'ROLE': case 'OWNERSHIP': return 'role';
    default: return 'facts';
  }
}

export interface Partner {
  id: string;
  sector: Sector;
  weight: number;         // for ordering inside the sector
  events: number;
  hostile: number;        // events on the hostile relation, if any
  cooperative: number;    // events on the cooperative relation, if any
  verified: number;       // events an article said (with quotes)
  wire: number;           // GDELT story-days
  links: GraphLink[];
}

/** Group a root's links by partner and decide each partner's sector and strength. */
export function partnersOf(rootId: string, links: GraphLink[]): Partner[] {
  const by = new Map<string, Partner>();
  for (const l of links) {
    const a = idOf(l.source), b = idOf(l.target);
    if (a !== rootId && b !== rootId) continue;
    const other = a === rootId ? b : a;
    if (other === rootId) continue;
    const p = by.get(other) ?? { id: other, sector: 'facts', weight: 0, events: 0, hostile: 0, cooperative: 0, verified: 0, wire: 0, links: [] };
    p.links.push(l);
    p.weight += l.weight ?? (l.origin === 'wikidata' || l.origin === 'connector' ? 1 : 0.5);
    p.events += l.event_count ?? 0;
    p.verified += l.verified_count ?? 0;
    p.wire += l.wire_count ?? 0;
    if (l.kind === 'HOSTILE') p.hostile += l.event_count ?? 0;
    if (l.kind === 'COOPERATIVE') p.cooperative += l.event_count ?? 0;
    by.set(other, p);
  }
  for (const p of by.values()) {
    if (p.hostile || p.cooperative) p.sector = p.hostile > p.cooperative ? 'hostile' : 'cooperative';
    else {
      const kinds = p.links.map(l => l.kind);
      p.sector = kinds.some(k => k === 'ROLE' || k === 'OWNERSHIP') ? 'role' : 'facts';
    }
  }
  return [...by.values()];
}

/**
 * Positions for every partner. Strongest nearest the sector axis, alternating sides so the
 * axis stays the "hot" spot; overflow goes to outer rings.
 */
export function wheelLayout(rootId: string, links: GraphLink[]): Map<string, WheelPos> {
  const out = new Map<string, WheelPos>();
  const partners = partnersOf(rootId, links);
  const counts = { cooperative: 0, role: 0, hostile: 0, facts: 0 } as Record<Sector, number>;
  partners.forEach(p => { counts[p.sector]++; });
  const spans = sectorSpans(counts);
  (Object.keys(SECTORS) as Sector[]).forEach(sector => {
    const members = partners.filter(p => p.sector === sector).sort((a, b) => b.weight - a.weight);
    const { from, to } = spans[sector];
    const axis = (from + to) / 2, half = (to - from) / 2;
    const capacity = Math.max(4, Math.floor((to - from) / DEG_PER_SLOT));
    for (let ring = 0; ring * capacity < members.length; ring++) {
      const slice = members.slice(ring * capacity, (ring + 1) * capacity);
      const n = slice.length;
      // slots: 0, +1, −1, +2, −2 … around the axis, evenly spread over the sector
      const step = n > 1 ? (2 * half) / n : 0;
      slice.forEach((p, i) => {
        const k = Math.ceil(i / 2) * (i % 2 === 0 ? -1 : 1);       // 0, +1, −1, +2, −2 …
        const offset = n % 2 === 0 ? (k + 0.5) * step : k * step;  // centre the pattern
        const angle = axis + Math.max(-half, Math.min(half, offset));
        const r = RING_RADIUS + ring * RING_STEP;
        const rad = (angle * Math.PI) / 180;
        out.set(p.id, { x: Math.cos(rad) * r, y: Math.sin(rad) * r, angle, ring, sector });
      });
    }
  });
  out.set(rootId, { x: 0, y: 0, angle: 0, ring: -1, sector: 'cooperative' });
  return out;
}

/**
 * Expansion: an expanded partner's own partners fan out on a small arc beyond it, centred on
 * the partner's angle, so the wheel stays readable.
 */
export function fanLayout(anchor: WheelPos, ids: string[], radius = 150, spread = 60): Map<string, WheelPos> {
  const out = new Map<string, WheelPos>();
  const n = ids.length;
  ids.forEach((id, i) => {
    const t = n > 1 ? i / (n - 1) - 0.5 : 0;
    const angle = anchor.angle + t * spread;
    const rad = (angle * Math.PI) / 180;
    out.set(id, { x: anchor.x + Math.cos(rad) * radius, y: anchor.y + Math.sin(rad) * radius, angle, ring: anchor.ring + 1, sector: anchor.sector });
  });
  return out;
}
