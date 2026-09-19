import { describe, expect, it } from 'vitest';
import { fanLayout, partnersOf, wheelLayout, RING_RADIUS, RING_STEP } from './wheelLayout';
import type { GraphLink } from '../../lib/types';

const link = (a: string, b: string, kind: GraphLink['kind'], n: number, origin: GraphLink['origin'] = 'events'): GraphLink =>
  ({ source: a, target: b, kind, origin, event_count: n, weight: n, label: '', confidence: 1 });

describe('partnersOf', () => {
  it('groups both relations of a pair and picks the busier side', () => {
    const ps = partnersOf('us', [link('us', 'iran', 'COOPERATIVE', 27), link('iran', 'us', 'HOSTILE', 19)]);
    expect(ps).toHaveLength(1);
    expect(ps[0]).toMatchObject({ id: 'iran', sector: 'cooperative', events: 46, hostile: 19, cooperative: 27 });
  });
  it('sends roles below and facts above', () => {
    const ps = partnersOf('us', [link('us', 'nato', 'MEMBERSHIP', 0, 'wikidata'), link('us', 'trump', 'ROLE', 0, 'wikidata')]);
    expect(Object.fromEntries(ps.map(p => [p.id, p.sector]))).toEqual({ nato: 'facts', trump: 'role' });
  });
});

describe('wheelLayout', () => {
  it('puts hostile partners on the left and cooperative on the right, strongest on the axis', () => {
    const pos = wheelLayout('us', [
      link('us', 'russia', 'HOSTILE', 30), link('us', 'cuba', 'HOSTILE', 4),
      link('us', 'saudi', 'COOPERATIVE', 34), link('us', 'japan', 'COOPERATIVE', 8),
    ]);
    expect(pos.get('us')).toMatchObject({ x: 0, y: 0 });
    expect(pos.get('russia')!.x).toBeLessThan(0);
    expect(pos.get('cuba')!.x).toBeLessThan(0);
    expect(pos.get('saudi')!.x).toBeGreaterThan(0);
    expect(Math.abs(pos.get('saudi')!.angle)).toBeLessThan(Math.abs(pos.get('japan')!.angle));
    expect(Math.abs(pos.get('russia')!.angle - 180)).toBeLessThan(Math.abs(pos.get('cuba')!.angle - 180));
  });
  it('widens a crowded sector and keeps everyone on the first ring when it fits', () => {
    // 40 cooperative, 2 hostile: the right side grows, the left side stays a narrow wedge
    const links = [
      ...Array.from({ length: 40 }, (_, i) => link('us', `c${i}`, 'COOPERATIVE', 40 - i)),
      link('us', 'h0', 'HOSTILE', 9), link('us', 'h1', 'HOSTILE', 3),
    ];
    const pos = wheelLayout('us', links);
    const coop = Array.from({ length: 40 }, (_, i) => pos.get(`c${i}`)!);
    expect(Math.max(...coop.map(p => Math.abs(p.angle)))).toBeGreaterThan(60);    // wider than the nominal 60°
    expect(Math.max(...coop.map(p => Math.abs(p.angle)))).toBeLessThan(126);      // never past the role / facts axes
    expect(coop.every(p => p.ring === 0)).toBe(true);
    expect(Math.abs(pos.get('h0')!.angle - 180)).toBeLessThan(13);
  });
  it('overflows to an outer ring when a sector is full', () => {
    const links = Array.from({ length: 80 }, (_, i) => link('us', `c${i}`, 'COOPERATIVE', 80 - i));
    const pos = wheelLayout('us', links);
    const radii = new Set([...pos.values()].filter(p => p.ring >= 0).map(p => Math.round(Math.hypot(p.x, p.y))));
    expect(radii).toEqual(new Set([RING_RADIUS, RING_RADIUS + RING_STEP]));
    expect(pos.get('c0')!.ring).toBe(0);
    expect(pos.get('c79')!.ring).toBe(1);
  });
  it('is deterministic', () => {
    const links = [link('us', 'a', 'HOSTILE', 3), link('us', 'b', 'COOPERATIVE', 5)];
    expect([...wheelLayout('us', links)]).toEqual([...wheelLayout('us', links)]);
  });
});

describe('fanLayout', () => {
  it('fans children beyond the anchor around its own angle', () => {
    const anchor = { x: 260, y: 0, angle: 0, ring: 0, sector: 'cooperative' as const };
    const fan = fanLayout(anchor, ['x', 'y', 'z']);
    expect(fan.get('y')).toMatchObject({ x: 410, y: 0 });
    expect(fan.get('x')!.y).toBeLessThan(0);
    expect(fan.get('z')!.y).toBeGreaterThan(0);
  });
});
