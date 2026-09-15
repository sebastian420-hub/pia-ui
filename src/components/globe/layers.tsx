import React from 'react';
import { PointPrimitiveCollection, PointPrimitive, BillboardCollection, Billboard, Entity, PointGraphics, LabelGraphics, EllipseGraphics } from 'resium';
import { Cartesian3, Cartesian2, Color, DistanceDisplayCondition, LabelStyle, NearFarScalar } from 'cesium';
import type { IntelligenceEvent, KgEvent, Sensor } from '../../lib/types';
import { priorityHex, CAMERA_HEX, toneHex } from '../../lib/symbology';

/*
 * Globe layers are memoised components with module-level constant Cesium objects.
 * Creating `new DistanceDisplayCondition()` inline in a render makes resium update
 * every primitive on every render — with 3,000+ cameras that freezes the page.
 */

const CAMERA_SVG = (hex: string) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
       <rect x="2" y="5" width="10" height="8" rx="1.5" fill="${hex}" stroke="#07090c" stroke-width="1"/>
       <path d="M12 8 L16 6 V12 L12 10 Z" fill="${hex}" stroke="#07090c" stroke-width="1"/>
     </svg>`);
const CAMERA_ICONS = { online: CAMERA_SVG(CAMERA_HEX.online), unknown: CAMERA_SVG(CAMERA_HEX.unknown), offline: CAMERA_SVG(CAMERA_HEX.offline) };
const CAMERA_SCALE = new NearFarScalar(2000, 1.0, 3000000, 0.35);
const CAMERA_DDC = new DistanceDisplayCondition(0, 4000000);
const ENTITY_DDC = new DistanceDisplayCondition(0, 12000000);
const LABEL_DDC = new DistanceDisplayCondition(0, 8000000);
const ENTITY_FILL = Color.fromCssColorString('rgba(59,130,246,0.35)');
const ENTITY_OUTLINE = Color.fromCssColorString('rgba(147,197,253,0.6)');
const DARK = Color.fromCssColorString('#07090c');
const LABEL_FILL = Color.fromCssColorString('#e6e9ed');
const LABEL_BG = Color.fromCssColorString('rgba(11,14,18,0.85)');
const LABEL_PAD = new Cartesian2(6, 3);
const LABEL_OFFSET = new Cartesian2(0, -16);
const INF = Number.POSITIVE_INFINITY;
const colorCache = new Map<string, Color>();
const color = (hex: string, alpha = 1) => {
  const k = `${hex}|${alpha}`;
  let c = colorCache.get(k);
  if (!c) { c = Color.fromCssColorString(hex).withAlpha(alpha); colorCache.set(k, c); }
  return c;
};

export const CameraLayer = React.memo(function CameraLayer({ cameras }: { cameras: Sensor[] }) {
  return (
    <BillboardCollection>
      {cameras.map(c => (
        <Billboard key={c.sensor_id} id={c}
          position={Cartesian3.fromDegrees(c.geo.lon, c.geo.lat, 30)}
          image={c.status === 'ONLINE' ? CAMERA_ICONS.online : c.status === 'OFFLINE' ? CAMERA_ICONS.offline : CAMERA_ICONS.unknown}
          scaleByDistance={CAMERA_SCALE} distanceDisplayCondition={CAMERA_DDC} disableDepthTestDistance={INF} />
      ))}
    </BillboardCollection>
  );
});

export const WatchedEntityLayer = React.memo(function WatchedEntityLayer({ entities }: { entities: IntelligenceEvent[] }) {
  return (
    <PointPrimitiveCollection>
      {entities.map(en => en.geo && (
        <PointPrimitive key={`en-${en.uid}`} position={Cartesian3.fromDegrees(en.geo.lon, en.geo.lat, 500)}
          color={ENTITY_FILL} outlineColor={ENTITY_OUTLINE} outlineWidth={1} pixelSize={5} distanceDisplayCondition={ENTITY_DDC} />
      ))}
    </PointPrimitiveCollection>
  );
});

export const EventLayer = React.memo(function EventLayer({ events }: { events: KgEvent[] }) {
  return (
    <PointPrimitiveCollection>
      {events.map(ev => ev.geo && (
        <PointPrimitive key={`ev-${ev.event_id}`} id={ev}
          position={Cartesian3.fromDegrees(ev.geo.lon, ev.geo.lat, 2000)}
          color={color(toneHex(ev.tone), 0.85)} outlineColor={DARK} outlineWidth={1}
          pixelSize={ev.action === 'ATTACK' ? 7 : 5} disableDepthTestDistance={INF} />
      ))}
    </PointPrimitiveCollection>
  );
});

export interface ClusterData { uid: string; name: string; domain: string; priority: string; lat: number; lon: number }

export const SituationLayer = React.memo(function SituationLayer({ clusters }: { clusters: ClusterData[] }) {
  return (
    <>
      {clusters.map(c => (
        <Entity key={`cluster-${c.uid}`} id={`situation:${c.uid}`} position={Cartesian3.fromDegrees(c.lon, c.lat, 0)}>
          <EllipseGraphics semiMajorAxis={50000} semiMinorAxis={50000} material={color(priorityHex(c.priority), 0.08)}
            outline outlineColor={color(priorityHex(c.priority), 0.45)} outlineWidth={1} height={0} />
        </Entity>
      ))}
    </>
  );
});

export const ReportLayer = React.memo(function ReportLayer({ reports, selectedUid }: { reports: IntelligenceEvent[]; selectedUid: string | null }) {
  return (
    <>
      {reports.map(ev => ev.geo && (
        <Entity key={ev.uid} id={`report:${ev.uid}`} position={Cartesian3.fromDegrees(ev.geo.lon, ev.geo.lat, 1000)}>
          <PointGraphics
            pixelSize={ev.priority === 'CRITICAL' ? 11 : ev.priority === 'HIGH' ? 9 : 6}
            color={color(priorityHex(ev.priority))} outlineColor={DARK} outlineWidth={1.5} disableDepthTestDistance={INF} />
          {(ev.priority === 'CRITICAL' || ev.priority === 'HIGH' || selectedUid === ev.uid) && (
            <LabelGraphics
              text={(ev.headline ?? '').slice(0, 48) + ((ev.headline?.length ?? 0) > 48 ? '…' : '')}
              font="11px JetBrains Mono, monospace" fillColor={LABEL_FILL} style={LabelStyle.FILL_AND_OUTLINE}
              outlineColor={DARK} outlineWidth={3} showBackground backgroundColor={LABEL_BG} backgroundPadding={LABEL_PAD}
              pixelOffset={LABEL_OFFSET} distanceDisplayCondition={LABEL_DDC} disableDepthTestDistance={INF} />
          )}
        </Entity>
      ))}
    </>
  );
});
