import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d';
import { X, ChevronRight } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { KIND_HEX, RELATION_HEX } from '../../lib/symbology';
import type { GraphData, GraphLink, GraphNode, RelationKind } from '../../lib/types';

type N = NodeObject<GraphNode>;
type L = LinkObject<GraphNode, GraphLink & { curvature?: number }>;

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
const idOf = (x: string | GraphNode | N | undefined): string => (typeof x === 'object' && x ? String(x.id) : String(x));
const pairKey = (l: GraphLink) => [idOf(l.source), idOf(l.target)].sort().join('|');
const NODE_LEGEND: [string, string][] = [['COUNTRY', KIND_HEX.COUNTRY], ['ORG', KIND_HEX.ORG], ['PERSON', KIND_HEX.PERSON], ['PLACE', KIND_HEX.PLACE], ['VESSEL', KIND_HEX.VESSEL]];
// Sectors: where a neighbour sits around its hub, by the kind of relation. Hostile left,
// cooperative right, roles and ownership below, Wikidata facts (membership / located) above.
const SECTOR_ANGLE: Record<RelationKind, number> = {
  HOSTILE: Math.PI, COOPERATIVE: 0, ROLE: Math.PI / 2, OWNERSHIP: Math.PI / 2,
  MEMBERSHIP: -Math.PI / 2, LOCATED: -Math.PI / 2, MENTIONED_WITH: -Math.PI / 2,
};
const SECTOR_RADIUS = 230;
const ALWAYS_LABELLED = 12;   // top nodes by weight keep their label at any zoom

/**
 * The web: entities and the relations between them.
 *   click node   → select (card in the inspector column)      double-click / right-click → expand
 *   click edge   → evidence in the inspector column           breadcrumb → previous roots
 * Solid = observed events (width = count), dashed = Wikidata fact, dotted = mentioned together.
 */
const WebView = forwardRef<WebViewHandle, Props>(function WebView(
  { entityKey, selectedId, onClose, onSelectEntity, onSelectEvidence, onRootChange }, ref,
) {
  const fgRef = useRef<ForceGraphMethods<N, L> | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [rootId, setRootId] = useState<string | null>(null);
  const [trail, setTrail] = useState<{ id: string; name: string }[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [kinds, setKinds] = useState<Record<RelationKind, boolean>>(DEFAULT_KINDS);
  const [showFacts, setShowFacts] = useState(true);
  const [minEvents, setMinEvents] = useState(1);
  const [topicsOff, setTopicsOff] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<N | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const lastClick = useRef<{ id: string; t: number }>({ id: '', t: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const merge = useCallback((incoming: GraphData) => {
    setData(prev => {
      const nodes = new Map(prev.nodes.map(n => [n.id, n]));
      incoming.nodes.forEach(n => { if (!nodes.has(n.id)) nodes.set(n.id, n); });
      const key = (l: GraphLink) => `${pairKey(l)}|${l.kind}|${l.origin}`;
      const links = new Map(prev.links.map(l => [key(l), l]));
      incoming.links.forEach(l => { if (!links.has(key(l))) links.set(key(l), l); });
      return { root: prev.root ?? incoming.root, nodes: [...nodes.values()], links: [...links.values()] };
    });
  }, []);

  const fetchAround = useCallback(async (key: string): Promise<GraphData | null> => {
    const r = await apiFetch<GraphData>(`/api/v1/graph/network/${encodeURIComponent(key)}?limit=60`);
    if (r.status !== 'success' || !r.data) { setError(r.message || 'Not in the knowledge web'); return null; }
    return r.data;
  }, []);

  /** (Re)root the web on an entity. */
  const root = useCallback(async (key: string, pushTrail: boolean) => {
    const d = await fetchAround(key);
    if (!d) return;
    const rootNode = d.nodes.find(n => n.id === d.root) ?? d.nodes[0];
    if (!rootNode) return;
    setData({ root: d.root, nodes: d.nodes, links: d.links });
    setExpanded(new Set([rootNode.id]));
    setRootId(rootNode.id);
    setError(null);
    onRootChange?.(rootNode.id);
    setTrail(prev => {
      const base = pushTrail ? prev : [];
      return [...base.filter(t => t.id !== rootNode.id), { id: rootNode.id, name: rootNode.name }];
    });
  }, [fetchAround, onRootChange]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) root(entityKey, false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityKey]);

  const expand = useCallback(async (id: string) => {
    if (expanded.has(id)) return;
    const d = await fetchAround(id);
    if (!d) return;
    merge({ nodes: d.nodes, links: d.links });
    setExpanded(prev => new Set(prev).add(id));
  }, [expanded, fetchAround, merge]);

  useImperativeHandle(ref, () => ({ expand, focus: (id) => root(id, true) }), [expand, root]);

  // ── filtering ────────────────────────────────────────────────────────────
  const visible = useMemo(() => {
    const links = data.links.filter(l => {
      if (!kinds[l.kind ?? 'MENTIONED_WITH']) return false;
      if (l.origin === 'wikidata' && !showFacts) return false;
      if (l.origin === 'events' && (l.event_count ?? 0) < minEvents) return false;
      if (topicsOff.size && l.origin === 'events' && l.topics?.length && l.topics.every(t => topicsOff.has(t.topic))) return false;
      return true;
    });
    const keep = new Set<string>(links.flatMap(l => [idOf(l.source), idOf(l.target)]));
    if (rootId) keep.add(rootId);
    if (selectedId) keep.add(selectedId);
    // several relations between the same pair fan out instead of overlapping
    const perPair = new Map<string, number>();
    const curved = links.map(l => {
      const k = pairKey(l);
      const n = perPair.get(k) ?? 0;
      perPair.set(k, n + 1);
      return { ...l, curvature: n === 0 ? 0 : (n % 2 ? 0.25 : -0.25) * Math.ceil(n / 2) };
    });
    return { nodes: data.nodes.filter(n => keep.has(n.id)), links: curved };
  }, [data, kinds, showFacts, minEvents, topicsOff, rootId, selectedId]);

  /** Topics present on the visible event edges, most frequent first (for the filter row). */
  const topicChips = useMemo(() => {
    const count = new Map<string, number>();
    data.links.forEach(l => l.topics?.forEach(t => { if (t.topic !== 'other') count.set(t.topic, (count.get(t.topic) ?? 0) + t.count); }));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [data.links]);

  /** Nodes that always carry a label: root, selection, its neighbours, and the top N by weight. */
  const labelled = useMemo(() => {
    const s = new Set<string>();
    [...visible.nodes].sort((a, b) => (b.val ?? 0) - (a.val ?? 0)).slice(0, ALWAYS_LABELLED).forEach(n => s.add(n.id));
    return s;
  }, [visible.nodes]);

  /** Sector target per node: the mean direction of its relation kinds to the hub it hangs from. */
  const sectorOf = useMemo(() => {
    const hubs = new Set<string>(expanded);
    if (rootId) hubs.add(rootId);
    const acc = new Map<string, { x: number; y: number; hub: string }>();
    visible.links.forEach(l => {
      const a = idOf(l.source), b = idOf(l.target);
      const kind = (l.kind ?? 'MENTIONED_WITH') as RelationKind;
      const ang = SECTOR_ANGLE[kind] ?? 0;
      const w = Math.log2(2 + (l.event_count ?? 1));   // 130 cooperative vs 15 hostile → mostly right
      const add = (node: string, hub: string) => {
        if (hubs.has(node)) return;
        const cur = acc.get(node) ?? { x: 0, y: 0, hub };
        acc.set(node, { x: cur.x + Math.cos(ang) * w, y: cur.y + Math.sin(ang) * w, hub: cur.hub });
      };
      if (hubs.has(a)) add(b, a);
      if (hubs.has(b)) add(a, b);
    });
    const out = new Map<string, { angle: number; hub: string }>();
    acc.forEach((v, id) => out.set(id, { angle: Math.atan2(v.y, v.x), hub: v.hub }));
    return out;
  }, [visible.links, expanded, rootId]);

  const neighbours = useMemo(() => {
    const s = new Set<string>();
    if (!selectedId) return s;
    visible.links.forEach(l => {
      const a = idOf(l.source), b = idOf(l.target);
      if (a === selectedId) s.add(b);
      if (b === selectedId) s.add(a);
    });
    return s;
  }, [visible.links, selectedId]);

  // Layout: enough repulsion to read labels; a sector force pulls each neighbour towards the
  // side its relation kind belongs to (hostile left, cooperative right …); fit once settled.
  const sectorRef = useRef(sectorOf);
  sectorRef.current = sectorOf;
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force('charge')?.strength(-260);
    fg.d3Force('link')?.distance((l: L) => (l.origin === 'events' ? 90 : 120)).strength(0.25);
    let nodes: N[] = [];
    const sector = (alpha: number) => {
      const byId = new Map(nodes.map(n => [String(n.id), n]));
      nodes.forEach(n => {
        const s = sectorRef.current.get(String(n.id));
        if (!s) return;
        const hub = byId.get(s.hub);
        const hx = hub?.x ?? 0, hy = hub?.y ?? 0;
        const tx = hx + Math.cos(s.angle) * SECTOR_RADIUS, ty = hy + Math.sin(s.angle) * SECTOR_RADIUS;
        n.vx = (n.vx ?? 0) + (tx - (n.x ?? 0)) * 0.12 * alpha;
        n.vy = (n.vy ?? 0) + (ty - (n.y ?? 0)) * 0.12 * alpha;
      });
    };
    (sector as unknown as { initialize: (ns: N[]) => void }).initialize = (ns: N[]) => { nodes = ns; };
    fg.d3Force('sector', sector as never);
    fg.d3ReheatSimulation();
  }, [data, visible.links.length]);

  // ── drawing ──────────────────────────────────────────────────────────────
  const drawNode = useCallback((node: N, ctx: CanvasRenderingContext2D, scale: number) => {
    const r = Math.max(3, Math.min(14, 2 + Math.sqrt(node.val ?? 3) * 1.6));
    const x = node.x ?? 0, y = node.y ?? 0;
    const isSel = node.id === selectedId, isRoot = node.id === rootId, isNb = neighbours.has(node.id);
    const dim = !!selectedId && !isSel && !isNb && !isRoot;
    ctx.globalAlpha = dim ? 0.35 : 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = KIND_HEX[node.group] ?? KIND_HEX.UNKNOWN;
    ctx.fill();
    if (isRoot || isSel || hover?.id === node.id) {
      ctx.lineWidth = (isSel ? 3 : 1.5) / scale;
      ctx.strokeStyle = isSel ? '#ffffff' : '#e6e9ed';
      ctx.stroke();
    }
    const showLabel = isRoot || isSel || isNb || hover?.id === node.id || labelled.has(node.id) || visible.nodes.length <= 20 || scale > 1.8;
    if (showLabel) {
      const fontSize = Math.max(11 / scale, 3);
      ctx.font = `${isRoot || isSel ? '600 ' : ''}${fontSize}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const label = node.name.length > 30 ? node.name.slice(0, 29) + '…' : node.name;
      const w = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(7,9,12,0.8)';
      ctx.fillRect(x - w / 2 - 2 / scale, y + r + 1 / scale, w + 4 / scale, fontSize + 2 / scale);
      ctx.fillStyle = '#e6e9ed';
      ctx.fillText(label, x, y + r + 2 / scale);
    }
    ctx.globalAlpha = 1;
  }, [rootId, selectedId, neighbours, hover, labelled, visible.nodes.length]);

  const linkColor = useCallback((l: L) => {
    const base = RELATION_HEX[l.kind ?? ''] ?? '#4b5563';
    if (!selectedId) return base;
    const touches = idOf(l.source) === selectedId || idOf(l.target) === selectedId;
    return touches ? base : base + '55';
  }, [selectedId]);

  const linkWidth = useCallback((l: L) => {
    if (l.origin === 'events') return Math.max(1, Math.min(6, 1 + Math.log2(1 + (l.event_count ?? 1)) * 1.4));
    return l.origin === 'wikidata' ? 1 : 0.8;
  }, []);

  const linkDash = useCallback((l: L) => (l.origin === 'wikidata' ? [6, 4] : l.origin === 'cooccurrence' ? [1.5, 3] : null), []);

  const handleNodeClick = useCallback((n: N) => {
    const now = Date.now();
    if (lastClick.current.id === n.id && now - lastClick.current.t < 350) { expand(n.id); return; }
    lastClick.current = { id: n.id, t: now };
    onSelectEntity(n.id);
  }, [expand, onSelectEntity]);

  const legend = useMemo(() => ALL_KINDS.map(k => [k, RELATION_HEX[k]] as const), []);
  const rootName = data.nodes.find(n => n.id === rootId)?.name ?? entityKey;

  return (
    <div className="absolute inset-0 z-30 bg-bg-0 flex flex-col font-mono text-[12px]">
      {/* header: breadcrumb + filters */}
      <div className="px-3 py-1.5 border-b border-line flex items-center gap-3 flex-wrap">
        <span className="text-[10px] tracking-[0.2em] text-text-3">WEB</span>
        <nav className="flex items-center gap-1 text-text-2">
          {trail.map((t, i) => (
            <React.Fragment key={t.id}>
              {i > 0 && <ChevronRight size={11} className="text-text-3" />}
              {t.id === rootId
                ? <span className="text-text-1">{t.name}</span>
                : <button onClick={() => root(t.id, true)} className="hover:text-text-1">{t.name}</button>}
            </React.Fragment>
          ))}
        </nav>
        <span className="text-text-3">{visible.nodes.length} entities · {visible.links.length} relations</span>
        <div className="ml-auto flex items-center gap-1 text-[10px]">
          {legend.map(([k, hex]) => (
            <button key={k} onClick={() => setKinds(p => ({ ...p, [k]: !p[k] }))}
              className={`px-1.5 py-0.5 rounded border ${kinds[k] ? 'border-line bg-bg-3 text-text-1' : 'border-transparent text-text-3'}`}>
              <span className="inline-block w-2.5 h-0.5 align-middle mr-1" style={{ background: hex, opacity: kinds[k] ? 1 : 0.4 }} />{k.toLowerCase()}
            </button>
          ))}
          <button onClick={() => setShowFacts(v => !v)} className={`px-1.5 py-0.5 rounded border ${showFacts ? 'border-line bg-bg-3 text-text-1' : 'border-transparent text-text-3'}`} title="Wikidata facts (dashed)">facts</button>
          <label className="flex items-center gap-1 text-text-3 ml-1" title="Minimum observed events for a solid edge">
            ≥<input type="range" min={1} max={10} value={minEvents} onChange={e => setMinEvents(Number(e.target.value))} className="w-16" />{minEvents}
          </label>
          <button onClick={onClose} className="ml-2 px-2 py-0.5 border border-line rounded text-text-2 hover:text-text-1 tracking-widest flex items-center gap-1"><X size={11} /> ESC</button>
        </div>
      </div>

      {/* second row: what the nodes are, and what the relations are about */}
      <div className="px-3 py-1 border-b border-line flex items-center gap-2 flex-wrap text-[10px]">
        <span className="text-text-3 tracking-[0.15em]">NODES</span>
        {NODE_LEGEND.map(([k, hex]) => (
          <span key={k} className="text-text-2"><span className="inline-block w-2 h-2 rounded-full align-middle mr-1" style={{ background: hex }} />{k.toLowerCase()}</span>
        ))}
        {topicChips.length > 0 && <>
          <span className="text-text-3 tracking-[0.15em] ml-3">ABOUT</span>
          {topicChips.map(([t, n]) => (
            <button key={t} onClick={() => setTopicsOff(p => { const s = new Set(p); if (s.has(t)) s.delete(t); else s.add(t); return s; })}
              className={`px-1.5 py-0.5 rounded border ${topicsOff.has(t) ? 'border-transparent text-text-3 line-through' : 'border-line bg-bg-3 text-text-1'}`}>
              {t.replace('_', ' ')} <span className="text-text-3">{n}</span>
            </button>
          ))}
        </>}
        <span className="ml-auto text-text-3">hostile ← · → cooperative · roles ↓ · facts ↑</span>
      </div>

      <div className="flex-1 relative min-h-0" ref={wrapRef}>
        {error && <div className="absolute inset-0 flex items-center justify-center text-err z-10">{error}</div>}
        {!error && visible.nodes.length === 0 && data.nodes.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-text-3 z-10">No relations pass the current filters for {rootName}.</div>
        )}
        <ForceGraph2D
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={visible}
          backgroundColor="#07090c"
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={(node: N, color, ctx) => { ctx.beginPath(); ctx.arc(node.x ?? 0, node.y ?? 0, 11, 0, 2 * Math.PI); ctx.fillStyle = color; ctx.fill(); }}
          nodeLabel={(n: N) => `${n.name} · ${n.group}${n.mentions ? ` · ${n.mentions} mentions` : ''}`}
          linkColor={linkColor}
          linkWidth={linkWidth}
          linkLineDash={linkDash}
          linkCurvature="curvature"
          linkHoverPrecision={10}
          linkLabel={(l: L) => {
            const about = l.topics?.length ? l.topics.slice(0, 2).map(t => `${t.topic.replace('_', ' ')} ${t.count}`).join(', ') : l.label;
            return `${(l.kind ?? '').toLowerCase()} · ${about}${l.event_count ? ` · ${l.event_count} events` : ''}${l.outlets?.length ? ` · ${l.outlets.slice(0, 3).join(', ')}` : ''}`;
          }}
          onNodeClick={handleNodeClick}
          onNodeRightClick={(n: N) => expand(n.id)}
          onNodeHover={(n: N | null) => setHover(n)}
          onLinkClick={(l: L) => onSelectEvidence(idOf(l.source), idOf(l.target))}
          cooldownTicks={120}
          d3VelocityDecay={0.3}
          onEngineStop={() => fgRef.current?.zoomToFit(400, 70)}
        />
        <div className="absolute bottom-2 left-3 text-[10px] text-text-3 pointer-events-none">
          click: details · double-click or right-click: expand · click a line: evidence · solid = observed, dashed = Wikidata, dotted = mentioned together
        </div>
      </div>
    </div>
  );
});

export default WebView;
