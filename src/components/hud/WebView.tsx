import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d';
import { X, ChevronRight } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { KIND_HEX, RELATION_HEX } from '../../lib/symbology';
import type { GraphData, GraphLink, GraphNode, RelationKind } from '../../lib/types';
import PartnerList from '../web/PartnerList';
import { fanLayout, partnersOf, wheelLayout, type Partner, type WheelPos } from '../web/wheelLayout';

type N = NodeObject<GraphNode & { fx?: number; fy?: number; dim?: boolean }>;
type L = LinkObject<GraphNode, GraphLink & { hostile_n?: number; coop_n?: number }>;

export interface WebViewHandle {
  expand: (id: string) => void;
  focus: (id: string) => void;
}

interface Props {
  entityKey: string;
  selectedId?: string | null;
  onClose: () => void;
  onSelectEntity: (id: string) => void;
  onSelectEvidence: (a: string, b: string) => void;
  onRootChange?: (id: string | null) => void;
}

const ALL_KINDS: RelationKind[] = ['HOSTILE', 'COOPERATIVE', 'ROLE', 'OWNERSHIP', 'MEMBERSHIP', 'LOCATED', 'MENTIONED_WITH'];
const DEFAULT_KINDS: Record<RelationKind, boolean> = {
  HOSTILE: true, COOPERATIVE: true, ROLE: true, OWNERSHIP: true, MEMBERSHIP: false, LOCATED: false, MENTIONED_WITH: false,
};
const KIND_SHORT: Record<RelationKind, string> = { HOSTILE: 'hostile', COOPERATIVE: 'coop', ROLE: 'role', OWNERSHIP: 'owns', MEMBERSHIP: 'member', LOCATED: 'located', MENTIONED_WITH: 'mentioned' };
const NODE_LEGEND: [string, string][] = [['COUNTRY', KIND_HEX.COUNTRY], ['ORG', KIND_HEX.ORG], ['PERSON', KIND_HEX.PERSON], ['PLACE', KIND_HEX.PLACE], ['VESSEL', KIND_HEX.VESSEL]];
const idOf = (x: string | GraphNode | N | undefined): string => (typeof x === 'object' && x ? String(x.id) : String(x));
const pairKey = (a: string, b: string) => [a, b].sort().join('|');

/**
 * The wheel: the root in the centre, partners on a fixed ring (hostile left, cooperative right,
 * roles below, facts above), every partner labelled, one line per pair. No physics: positions
 * come from wheelLayout and never move on their own. A ranked list of the same partners sits
 * on the left. Click = select (card in the inspector), click a line = evidence, double-click /
 * right-click = expand (a fan beyond the partner), "focus" = re-centre (breadcrumb back).
 */
const WebView = forwardRef<WebViewHandle, Props>(function WebView(
  { entityKey, selectedId: selectedKey, onClose, onSelectEntity, onSelectEvidence, onRootChange }, ref,
) {
  const fgRef = useRef<ForceGraphMethods<N, L> | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [rootId, setRootId] = useState<string | null>(null);
  const [trail, setTrail] = useState<{ id: string; name: string }[]>([]);
  const [fans, setFans] = useState<Map<string, GraphData>>(new Map());   // expanded partner → its 1-hop
  const [kinds, setKinds] = useState<Record<RelationKind, boolean>>(DEFAULT_KINDS);
  const [topicsOff, setTopicsOff] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const lastClick = useRef<{ id: string; t: number }>({ id: '', t: 0 });

  // the inspector may select by entity id or by Q-id; the wheel works in entity ids
  const selectedId = useMemo(() => {
    if (!selectedKey) return null;
    const k = selectedKey.toLowerCase();
    return data.nodes.find(n => n.id === selectedKey || n.qid === selectedKey || n.name.toLowerCase() === k)?.id ?? selectedKey;
  }, [selectedKey, data.nodes]);
  const dimOthers = !!selectedId && selectedId !== rootId;   // selecting the root itself dims nothing

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // the inspector column opening / closing changes the cell: keep the wheel centred and whole
  useEffect(() => {
    const t = setTimeout(() => fgRef.current?.zoomToFit(250, 50), 80);
    return () => clearTimeout(t);
  }, [size.w, size.h]);

  const fetchAround = useCallback(async (key: string): Promise<GraphData | null> => {
    const r = await apiFetch<GraphData>(`/api/v1/graph/network/${encodeURIComponent(key)}?limit=120`);
    if (r.status !== 'success' || !r.data) { setError(r.message || 'Not in the knowledge web'); return null; }
    return r.data;
  }, []);

  /** (Re)root the wheel on an entity. */
  const root = useCallback(async (key: string, pushTrail: boolean) => {
    const d = await fetchAround(key);
    if (!d) return;
    const rootNode = d.nodes.find(n => n.id === d.root) ?? d.nodes[0];
    if (!rootNode) return;
    setData({ root: d.root, nodes: d.nodes, links: d.links });
    setFans(new Map());
    setRootId(rootNode.id);
    setError(null);
    onRootChange?.(rootNode.id);
    setTrail(prev => {
      const base = pushTrail ? prev : [];
      return [...base.filter(t => t.id !== rootNode.id), { id: rootNode.id, name: rootNode.name }];
    });
    setTimeout(() => fgRef.current?.zoomToFit(300, 60), 50);
  }, [fetchAround, onRootChange]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) root(entityKey, false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityKey]);

  const expand = useCallback(async (id: string) => {
    if (id === rootId || fans.has(id)) return;
    const d = await fetchAround(id);
    if (!d) return;
    setFans(prev => new Map(prev).set(id, d));
  }, [rootId, fans, fetchAround]);

  useImperativeHandle(ref, () => ({ expand, focus: (id) => root(id, true) }), [expand, root]);

  // ── filtering ────────────────────────────────────────────────────────────
  const passes = useCallback((l: GraphLink) => {
    if (!kinds[l.kind ?? 'MENTIONED_WITH']) return false;
    if (topicsOff.size && l.origin === 'events' && l.topics?.length && l.topics.every(t => topicsOff.has(t.topic))) return false;
    return true;
  }, [kinds, topicsOff]);

  const topicChips = useMemo(() => {
    const count = new Map<string, number>();
    data.links.forEach(l => l.topics?.forEach(t => { if (t.topic !== 'other') count.set(t.topic, (count.get(t.topic) ?? 0) + t.count); }));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [data.links]);

  /** Partners of the root under the current filters, and their fixed positions. */
  const wheel = useMemo(() => {
    if (!rootId) return { partners: [] as Partner[], pos: new Map<string, WheelPos>() };
    const links = data.links.filter(passes);
    return { partners: partnersOf(rootId, links), pos: wheelLayout(rootId, links) };
  }, [data.links, rootId, passes]);

  /** Everything drawn: root, ring partners, and the fans of expanded partners. */
  const scene = useMemo(() => {
    const nodes = new Map<string, GraphNode>(data.nodes.map(n => [n.id, n]));
    const pos = new Map(wheel.pos);
    const merged: Record<string, L> = {};
    const addLink = (l: GraphLink) => {
      const a = idOf(l.source), b = idOf(l.target);
      if (!pos.has(a) || !pos.has(b)) return;
      const k = pairKey(a, b);
      const cur = merged[k];
      if (!cur) { merged[k] = { ...l, source: a, target: b, hostile_n: l.kind === 'HOSTILE' ? l.event_count : 0, coop_n: l.kind === 'COOPERATIVE' ? l.event_count : 0 }; return; }
      // one line per pair: keep the stronger relation's kind, remember both counts
      if (l.kind === 'HOSTILE') cur.hostile_n = (cur.hostile_n ?? 0) + (l.event_count ?? 0);
      if (l.kind === 'COOPERATIVE') cur.coop_n = (cur.coop_n ?? 0) + (l.event_count ?? 0);
      if ((l.weight ?? 0) > (cur.weight ?? 0)) Object.assign(cur, { kind: l.kind, label: l.label, weight: l.weight, topics: l.topics, outlets: l.outlets, why: l.why ?? cur.why });
      cur.event_count = (cur.event_count ?? 0) + (l.event_count ?? 0);
      cur.verified_count = (cur.verified_count ?? 0) + (l.verified_count ?? 0);
      cur.wire_count = (cur.wire_count ?? 0) + (l.wire_count ?? 0);
    };
    fans.forEach((d, anchorId) => {
      const anchor = pos.get(anchorId);
      if (!anchor) return;
      const kids = partnersOf(anchorId, d.links.filter(passes)).filter(p => !pos.has(p.id)).sort((a, b) => b.weight - a.weight).slice(0, 12);
      fanLayout(anchor, kids.map(k => k.id)).forEach((p, id) => pos.set(id, p));
      d.nodes.forEach(n => { if (!nodes.has(n.id)) nodes.set(n.id, n); });
    });
    data.links.filter(passes).forEach(addLink);
    fans.forEach((d, anchorId) => d.links.filter(passes).forEach(l => {
      const a = idOf(l.source), b = idOf(l.target);
      if (a === anchorId || b === anchorId) addLink(l);
    }));
    const drawn: N[] = [];
    pos.forEach((p, id) => {
      const n = nodes.get(id);
      if (n) drawn.push({ ...n, fx: p.x, fy: p.y, x: p.x, y: p.y, dim: !wheel.pos.has(id) });
    });
    return { nodes: drawn, links: Object.values(merged), nodeMap: nodes, pos };
  }, [data, wheel, fans, passes]);

  const neighbours = useMemo(() => {
    const s = new Set<string>();
    if (!selectedId) return s;
    scene.links.forEach(l => {
      const a = idOf(l.source), b = idOf(l.target);
      if (a === selectedId) s.add(b);
      if (b === selectedId) s.add(a);
    });
    return s;
  }, [scene.links, selectedId]);

  // ── drawing ──────────────────────────────────────────────────────────────
  const drawNode = useCallback((node: N, ctx: CanvasRenderingContext2D, scale: number) => {
    const id = String(node.id);
    const isRoot = id === rootId, isSel = id === selectedId, isHot = hover === id, isNb = neighbours.has(id);
    const r = isRoot ? 16 : Math.max(5, Math.min(12, 4 + Math.sqrt(node.mentions ?? 1) * 0.35));
    const x = node.x ?? 0, y = node.y ?? 0;
    const dim = (dimOthers && !isSel && !isNb && !isRoot) || !!node.dim;
    ctx.globalAlpha = dim ? 0.45 : 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = KIND_HEX[node.group] ?? KIND_HEX.UNKNOWN;
    ctx.fill();
    if (isRoot || isSel || isHot) {
      ctx.lineWidth = (isSel || isRoot ? 3 : 1.5) / scale;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
    // radial label: outside the ring, reading outward; the root's label sits below the centre
    const pos = scene.pos.get(id);
    const fontSize = Math.max(12 / scale, 4);
    ctx.font = `${isRoot || isSel ? '600 ' : ''}${fontSize}px JetBrains Mono, monospace`;
    ctx.fillStyle = dim ? '#8b93a1' : '#e6e9ed';
    const label = node.name.length > 34 ? node.name.slice(0, 33) + '…' : node.name;
    if (isRoot || !pos || pos.ring < 0) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(label, x, y + r + 3 / scale);
    } else {
      // along the spoke, like a chord diagram: no two labels can collide, and the left side is
      // flipped so every label reads left-to-right
      const rad = (pos.angle * Math.PI) / 180;
      const right = Math.cos(rad) >= 0;
      ctx.save();
      ctx.translate(x + Math.cos(rad) * (r + 5 / scale), y + Math.sin(rad) * (r + 5 / scale));
      ctx.rotate(right ? rad : rad + Math.PI);
      ctx.textAlign = right ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }, [rootId, selectedId, dimOthers, hover, neighbours, scene.pos]);

  /** One line per pair; both kinds present → two parallel strokes (red / green) sharing the width. */
  const drawLink = useCallback((l: L, ctx: CanvasRenderingContext2D) => {
    const s = l.source as N, t = l.target as N;
    if (typeof s !== 'object' || typeof t !== 'object') return;
    const a = String(s.id), b = String(t.id);
    const touches = !dimOthers || a === selectedId || b === selectedId;
    const hot = hover && (a === hover || b === hover);
    // verified (an article said it) = solid, width from verified events; wire-only = thin and faint
    const verified = (l.verified_count ?? 0) > 0;
    const alpha = (touches ? (hot ? 1 : 0.85) : 0.18) * (l.origin === 'events' && !verified ? 0.5 : 1);
    const width = l.origin === 'events'
      ? (verified ? Math.max(1.5, Math.min(7, 1.2 + Math.log2(1 + (l.verified_count ?? 1)) * 1.5)) : 1)
      : 1;
    const dash = l.origin === 'wikidata' ? [6, 4] : l.origin === 'cooccurrence' ? [2, 3] : [];
    const strokes: [string, number][] = [];
    if ((l.hostile_n ?? 0) > 0 && (l.coop_n ?? 0) > 0) {
      const tot = (l.hostile_n ?? 0) + (l.coop_n ?? 0);
      strokes.push([RELATION_HEX.COOPERATIVE, width * ((l.coop_n ?? 0) / tot)], [RELATION_HEX.HOSTILE, width * ((l.hostile_n ?? 0) / tot)]);
    } else strokes.push([RELATION_HEX[l.kind ?? ''] ?? '#4b5563', width]);
    const sx = s.x ?? 0, sy = s.y ?? 0, tx = t.x ?? 0, ty = t.y ?? 0;
    const dx = tx - sx, dy = ty - sy, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    let off = -strokes.reduce((acc, [, w]) => acc + w, 0) / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.setLineDash(dash);
    strokes.forEach(([colour, w]) => {
      const o = off + w / 2;
      ctx.beginPath();
      ctx.moveTo(sx + nx * o, sy + ny * o);
      ctx.lineTo(tx + nx * o, ty + ny * o);
      ctx.strokeStyle = colour; ctx.lineWidth = w;
      ctx.stroke();
      off += w;
    });
    ctx.restore();
  }, [selectedId, dimOthers, hover]);

  const handleNodeClick = useCallback((n: N) => {
    const id = String(n.id), now = Date.now();
    if (lastClick.current.id === id && now - lastClick.current.t < 350) { expand(id); return; }
    lastClick.current = { id, t: now };
    onSelectEntity(id);
  }, [expand, onSelectEntity]);

  const rootName = data.nodes.find(n => n.id === rootId)?.name ?? entityKey;
  const legend = useMemo(() => ALL_KINDS.map(k => [k, RELATION_HEX[k]] as const), []);

  return (
    <div className="absolute inset-0 z-30 bg-bg-0 flex flex-col font-mono text-[12px] overflow-hidden">
      {/* one header row: breadcrumb · count · kind toggles · topic chips · close */}
      <div className="px-3 py-1.5 border-b border-line flex items-center gap-3 whitespace-nowrap overflow-x-auto no-scrollbar shrink-0">
        <span className="text-[10px] tracking-[0.2em] text-text-3">WEB</span>
        <nav className="flex items-center gap-1 text-text-2">
          <button onClick={onClose} className="hover:text-text-1">Globe</button>
          {trail.map(t => (
            <React.Fragment key={t.id}>
              <ChevronRight size={11} className="text-text-3" />
              {t.id === rootId
                ? <span className="text-text-1">{t.name}</span>
                : <button onClick={() => root(t.id, true)} className="hover:text-text-1">{t.name}</button>}
            </React.Fragment>
          ))}
        </nav>
        <span className="text-text-3">{wheel.partners.length} partners</span>
        <div className="ml-auto flex items-center gap-1 text-[10px] shrink-0">
          {legend.map(([k, hex]) => (
            <button key={k} onClick={() => setKinds(p => ({ ...p, [k]: !p[k] }))} title={k.toLowerCase().replace('_', ' ')}
              className={`px-1.5 py-0.5 rounded border ${kinds[k] ? 'border-line bg-bg-3 text-text-1' : 'border-transparent text-text-3'}`}>
              <span className="inline-block w-2.5 h-0.5 align-middle mr-1" style={{ background: hex, opacity: kinds[k] ? 1 : 0.4 }} />{KIND_SHORT[k]}
            </button>
          ))}
          {topicChips.length > 0 && <span className="text-text-3 ml-2">about</span>}
          {topicChips.map(([t, n]) => (
            <button key={t} onClick={() => setTopicsOff(p => { const s = new Set(p); if (s.has(t)) s.delete(t); else s.add(t); return s; })}
              className={`px-1.5 py-0.5 rounded border ${topicsOff.has(t) ? 'border-transparent text-text-3 line-through' : 'border-line bg-bg-3 text-text-1'}`}>
              {t.replace('_', ' ')} <span className="text-text-3">{n}</span>
            </button>
          ))}
          <button onClick={onClose} className="ml-2 px-2 py-0.5 border border-line rounded text-text-2 hover:text-text-1 tracking-widest flex items-center gap-1"><X size={11} /> ESC</button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <PartnerList partners={wheel.partners} nodes={scene.nodeMap} selectedId={selectedId} hoverId={hover}
          onSelect={onSelectEntity} onHover={setHover}
          onEvidence={(id) => { if (rootId) onSelectEvidence(rootId, id); }} />
        <div className="flex-1 relative min-h-0 min-w-0 overflow-hidden" ref={wrapRef}>
          {error && <div className="absolute inset-0 flex items-center justify-center text-err z-10">{error}</div>}
          {!error && wheel.partners.length === 0 && data.nodes.length > 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-text-3 z-10">No relations pass the current filters for {rootName}.</div>
          )}
          <ForceGraph2D
            ref={fgRef}
            width={size.w}
            height={size.h}
            graphData={scene}
            backgroundColor="#07090c"
            cooldownTicks={0}
            enableNodeDrag={false}
            nodeCanvasObject={drawNode}
            nodePointerAreaPaint={(node: N, color, ctx) => { ctx.beginPath(); ctx.arc(node.x ?? 0, node.y ?? 0, 14, 0, 2 * Math.PI); ctx.fillStyle = color; ctx.fill(); }}
            nodeLabel={() => ''}
            linkCanvasObject={drawLink}
            linkCanvasObjectMode={() => 'replace'}
            linkHoverPrecision={8}
            linkLabel={(l: L) => {
              const about = l.why?.predicate ? `${l.why.predicate}${l.why.quote ? ` — “${l.why.quote.slice(0, 90)}${l.why.quote.length > 90 ? '…' : ''}”` : ''}`
                : l.topics?.length ? l.topics.slice(0, 2).map(t => `${t.topic.replace('_', ' ')} ${t.count}`).join(', ') : l.label;
              const both = (l.hostile_n ?? 0) > 0 && (l.coop_n ?? 0) > 0 ? ` · ${l.coop_n} cooperative / ${l.hostile_n} hostile` : '';
              const v = l.origin === 'events' ? ` · ${l.verified_count ?? 0} verified · ${l.wire_count ?? 0} wire` : '';
              return `${about}${both}${v}${l.outlets?.length ? ` · ${l.outlets.slice(0, 3).join(', ')}` : ''}`;
            }}
            onNodeClick={handleNodeClick}
            onNodeRightClick={(n: N) => expand(String(n.id))}
            onNodeHover={(n: N | null) => setHover(n ? String(n.id) : null)}
            onLinkClick={(l: L) => onSelectEvidence(idOf(l.source), idOf(l.target))}
          />
          <div className="absolute top-2 left-3 text-[10px] text-text-3 pointer-events-none flex gap-3">
            {NODE_LEGEND.map(([k, hex]) => (
              <span key={k}><span className="inline-block w-2 h-2 rounded-full align-middle mr-1" style={{ background: hex }} />{k.toLowerCase()}</span>
            ))}
          </div>
          <div className="absolute bottom-2 left-3 text-[10px] text-text-3 pointer-events-none">
            hostile ← · → cooperative · roles ↓ · facts ↑ · solid = verified by an article · faint = wire only · dashed = Wikidata · click a line: evidence
          </div>
        </div>
      </div>
    </div>
  );
});

export default WebView;
