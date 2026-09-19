import React, { useMemo } from 'react';
import { PointPrimitiveCollection, PointPrimitive, LabelCollection, Label, Entity, PolylineGraphics } from 'resium';
import { Cartesian3, Cartesian2, Color, Cartographic, EllipsoidGeodesic, LabelStyle } from 'cesium';
import { KIND_HEX, RELATION_HEX } from '../../lib/symbology';
import type { WebOverview, WebOverviewLink, WebOverviewNode } from '../../lib/types';
import { TIER_RULES, type WebTier } from './webTier';

/*
 * The web from far away, on the globe: entities as points where they are (countries at their
 * point, organisations and people orbiting their country), the strongest pairs as arcs.
 * Semantic zoom by camera height (tier 0 = far … 2 = near) keeps the far view to countries,
 * big organisations, thick arcs and a few labels. All Cesium objects are module constants or
 * memoised so the layer does not rebuild on every render (see layers.tsx).
 */

const DARK = Color.fromCssColorString('#07090c');
const LABEL_FILL = Color.fromCssColorString('#e6e9ed');
const LABEL_BG = Color.fromCssColorString('rgba(11,14,18,0.85)');
const LABEL_PAD = new Cartesian2(5, 2);
const LABEL_OFFSET = new Cartesian2(0, -14);
const colorCache = new Map<string, Color>();
const color = (hex: string, alpha = 1) => {
  const k = `${hex}/${alpha}`;
  let c = colorCache.get(k);
  if (!c) { c = Color.fromCssColorString(hex).withAlpha(alpha); colorCache.set(k, c); }
  return c;
};
// Arcs are Entities (PolylineGraphics with a plain Color), not PolylineCollection primitives:
// the primitive collection destroys a polyline's Material with the polyline, which throws
// "This object was destroyed" as soon as React swaps arcs in and out.

/** Deterministic small offset so an orbiting org / person sits beside its country, not on it. */
function orbit(n: WebOverviewNode): [number, number] {
  if (!n.orbits || n.lat == null || n.lon == null) return [n.lon ?? 0, n.lat ?? 0];
  let h = 0;
  for (const ch of n.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const angle = (h % 360) * (Math.PI / 180);
  const r = n.kind === 'PERSON' ? 3.2 : 2.4;   // degrees
  return [n.lon + Math.cos(angle) * r / Math.max(0.3, Math.cos((n.lat * Math.PI) / 180)), n.lat + Math.sin(angle) * r];
}

/** Arc between two points: geodesic samples lifted by a sine, height ∝ distance. */
function arc(a: [number, number], b: [number, number], lift = 0.045, extra = 0): Cartesian3[] {
  const g = new EllipsoidGeodesic(Cartographic.fromDegrees(a[0], a[1]), Cartographic.fromDegrees(b[0], b[1]));
  const d = g.surfaceDistance;
  const n = 24;
  const peak = Math.min(400_000, Math.max(40_000, d * lift));   // hugs the globe: 40–400 km high
  const out: Cartesian3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const c = g.interpolateUsingFraction(t);
    const h = Math.sin(Math.PI * t) * (peak + extra) + 5000;
    out.push(Cartesian3.fromRadians(c.longitude, c.latitude, h));
  }
  return out;
}

interface Props {
  data: WebOverview | null;
  tier: WebTier;
  showHostile: boolean;
  showCooperative: boolean;
  topicsOff: Set<string>;
  selectedId?: string | null;
}

export interface WebPickNode { web_node: string; name: string }


export const WebLayer = React.memo(function WebLayer({ data, tier, showHostile, showCooperative, topicsOff, selectedId }: Props) {
  const scene = useMemo(() => {
    if (!data) return { nodes: [] as (WebOverviewNode & { lon: number; lat: number; size: number })[], links: [] as (WebOverviewLink & { positions: Cartesian3[]; positions2?: Cartesian3[]; width: number; hex: string; hex2?: string })[], labelled: new Set<string>() };
    const rules = TIER_RULES[tier];
    const pos = new Map<string, [number, number]>();
    data.nodes.forEach(n => { if (n.lat != null && n.lon != null) pos.set(n.id, orbit(n)); });
    const links = data.links.filter(l => {
      if (l.event_count < rules.minEvents) return false;
      if (!pos.has(l.source) || !pos.has(l.target)) return false;
      if (!((l.hostile_n > 0 && showHostile) || (l.coop_n > 0 && showCooperative))) return false;
      if (topicsOff.size && l.topics?.length && l.topics.every(t => topicsOff.has(t.topic))) return false;
      return true;
    }).map(l => {
      const a = pos.get(l.source)!, b = pos.get(l.target)!;
      // only the kinds that are switched on are drawn: with "coop" off, a mixed pair shows its
      // hostile stroke alone, sized by its hostile events
      const h = showHostile ? l.hostile_n : 0, c = showCooperative ? l.coop_n : 0;
      const shown = h + c;
      const width = Math.max(1.5, Math.min(9, 1 + Math.log2(1 + shown) * 1.2));
      const both = h > 0 && c > 0;
      const main: 'HOSTILE' | 'COOPERATIVE' = h > c ? 'HOSTILE' : 'COOPERATIVE';
      const hex = RELATION_HEX[main];
      const hex2 = both ? RELATION_HEX[main === 'HOSTILE' ? 'COOPERATIVE' : 'HOSTILE'] : undefined;
      return { ...l, kind: main, positions: arc(a, b), positions2: both ? arc(a, b, 0.045, 25_000) : undefined, width, hex, hex2 };
    });
    const linked = new Set<string>(links.flatMap(l => [l.source, l.target]));
    const nodes = data.nodes
      .filter(n => pos.has(n.id) && (n.kind === 'COUNTRY' || n.activity >= rules.orgActivity) && (tier === 2 || linked.has(n.id)))
      .map(n => { const [lon, lat] = pos.get(n.id)!; return { ...n, lon, lat, size: Math.max(5, Math.min(16, 4 + Math.sqrt(n.activity) * 0.9)) }; });
    const labelled = new Set([...nodes].sort((x, y) => y.activity - x.activity).slice(0, rules.labels).map(n => n.id));
    if (selectedId) labelled.add(selectedId);
    return { nodes, links, labelled };
  }, [data, tier, showHostile, showCooperative, topicsOff, selectedId]);

  return (
    <>
      {scene.links.map(l => {
        const touches = !selectedId || l.source === selectedId || l.target === selectedId;
        const alpha = touches ? 0.85 : 0.15;
        const key = `${l.source}|${l.target}`;
        return (
          <React.Fragment key={key}>
            <Entity id={`web_link:${key}`}>
              <PolylineGraphics positions={l.positions} width={l.width} material={color(l.hex, alpha)} />
            </Entity>
            {l.positions2 && l.hex2 && (
              <Entity id={`web_link2:${key}`}>
                <PolylineGraphics positions={l.positions2} width={Math.max(1, l.width * 0.5)} material={color(l.hex2, alpha)} />
              </Entity>
            )}
          </React.Fragment>
        );
      })}
      <PointPrimitiveCollection>
        {scene.nodes.map(n => (
          <PointPrimitive key={n.id} id={{ web_node: n.id, name: n.name } as WebPickNode}
            position={Cartesian3.fromDegrees(n.lon, n.lat, 6000)}
            color={color(KIND_HEX[n.kind] ?? KIND_HEX.UNKNOWN, n.id === selectedId ? 1 : 0.9)}
            outlineColor={n.id === selectedId ? LABEL_FILL : DARK} outlineWidth={n.id === selectedId ? 2 : 1}
            pixelSize={n.size} />
        ))}
      </PointPrimitiveCollection>
      <LabelCollection>
        {scene.nodes.filter(n => scene.labelled.has(n.id)).map(n => (
          <Label key={`l-${n.id}`} id={{ web_node: n.id, name: n.name } as WebPickNode}
            position={Cartesian3.fromDegrees(n.lon, n.lat, 6000)} text={n.name.length > 26 ? n.name.slice(0, 25) + '…' : n.name}
            font={`${n.id === selectedId ? '600 ' : ''}11px JetBrains Mono, monospace`} fillColor={LABEL_FILL}
            showBackground backgroundColor={LABEL_BG} backgroundPadding={LABEL_PAD} pixelOffset={LABEL_OFFSET}
            style={LabelStyle.FILL} scale={1} />
        ))}
      </LabelCollection>
    </>
  );
});

export default WebLayer;
