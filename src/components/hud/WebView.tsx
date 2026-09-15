import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d';
import { X, Plus, ExternalLink } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { zuluDateTime, zuluShort } from '../../lib/format';
import { KIND_HEX, RELATION_HEX } from '../../lib/symbology';
import type { GraphData, GraphLink, GraphNode, RelationEvidence } from '../../lib/types';

type N = NodeObject<GraphNode>;
type L = LinkObject<GraphNode, GraphLink>;

interface Props {
  entityKey: string;
  onClose: () => void;
  onOpenEntity: (key: string) => void;
}

const idOf = (x: string | GraphNode | N | undefined): string => (typeof x === 'object' && x ? String(x.id) : String(x));

/**
 * The investigation view: a 2-D web around one entity. Click a node to expand it one hop,
 * click an edge to read the evidence (events with quotes, shared reports).
 */
const WebView: React.FC<Props> = ({ entityKey, onClose, onOpenEntity }) => {
  const fgRef = useRef<ForceGraphMethods<N, L> | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [rootId, setRootId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedLink, setSelectedLink] = useState<L | null>(null);
  const [evidence, setEvidence] = useState<RelationEvidence | null>(null);
  const [hover, setHover] = useState<N | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

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
      const key = (l: GraphLink) => `${idOf(l.source)}|${idOf(l.target)}|${l.kind ?? l.label}`;
      const links = new Map(prev.links.map(l => [key(l), l]));
      incoming.links.forEach(l => { if (!links.has(key(l))) links.set(key(l), l); });
      return { nodes: [...nodes.values()], links: [...links.values()] };
    });
  }, []);

  const MAX_LINKS_PER_EXPAND = 40;

  const load = useCallback(async (key: string, hops = 1) => {
    const r = await apiFetch<GraphData>(`/api/v1/graph/network/${encodeURIComponent(key)}?hops=${hops}`);
    if (r.status !== 'success' || !r.data) { setError(r.message || 'Not in the knowledge web'); return null; }
    // Keep the strongest edges so one country does not pull in 200 treaty memberships at once.
    const links = [...r.data.links].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)).slice(0, MAX_LINKS_PER_EXPAND);
    const keep = new Set<string>(links.flatMap(l => [idOf(l.source), idOf(l.target)]));
    const root = r.data.nodes.find(n => n.val === 30);
    if (root) keep.add(root.id);
    const trimmed = { nodes: r.data.nodes.filter(n => keep.has(n.id)), links };
    merge(trimmed);
    return trimmed;
  }, [merge]);

  // Layout: more repulsion than the default, then fit the view once the simulation settles.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force('charge')?.strength(-260);
    fg.d3Force('link')?.distance(70);
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(async () => {
      if (cancelled) return;
      setData({ nodes: [], links: [] }); setEvidence(null); setSelectedLink(null); setError(null);
      const d = await load(entityKey, 1);
      if (cancelled || !d) return;
      const root = d.nodes.find(n => n.val === 30) ?? d.nodes[0];
      if (root) { setRootId(root.id); setExpanded(new Set([root.id])); }
    });
    return () => { cancelled = true; };
  }, [entityKey, load]);

  const expand = useCallback(async (node: N) => {
    if (expanded.has(node.id)) { onOpenEntity(node.id); return; }
    await load(node.id, 1);
    setExpanded(prev => new Set(prev).add(node.id));
  }, [expanded, load, onOpenEntity]);

  const showEvidence = useCallback(async (link: L) => {
    setSelectedLink(link);
    setEvidence(null);
    const r = await apiFetch<RelationEvidence>(`/api/v1/kg/relations/${idOf(link.source)}/${idOf(link.target)}`);
    if (r.status === 'success' && r.data) setEvidence(r.data);
  }, []);

  const drawNode = useCallback((node: N, ctx: CanvasRenderingContext2D, scale: number) => {
    const r = Math.max(3, Math.min(14, 3 + Math.sqrt(node.val ?? 3)));
    const x = node.x ?? 0, y = node.y ?? 0;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = KIND_HEX[node.group] ?? KIND_HEX.UNKNOWN;
    ctx.fill();
    if (node.id === rootId || hover?.id === node.id) { ctx.lineWidth = 2 / scale; ctx.strokeStyle = '#e6e9ed'; ctx.stroke(); }
    const showLabel = node.id === rootId || hover?.id === node.id || data.nodes.length <= 25 || (node.val ?? 0) >= 5 || scale > 1.6;
    if (!showLabel) return;
    const fontSize = Math.max(10 / scale, 3);
    ctx.font = `${node.id === rootId ? '600 ' : ''}${fontSize}px JetBrains Mono, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const label = node.name.length > 28 ? node.name.slice(0, 27) + '…' : node.name;
    const w = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(7,9,12,0.75)';
    ctx.fillRect(x - w / 2 - 2 / scale, y + r + 1 / scale, w + 4 / scale, fontSize + 2 / scale);
    ctx.fillStyle = '#e6e9ed';
    ctx.fillText(label, x, y + r + 2 / scale);
  }, [rootId, hover, data.nodes.length]);

  const linkColor = useCallback((l: L) => {
    const base = RELATION_HEX[l.kind ?? ''] ?? '#4b5563';
    return selectedLink && selectedLink === l ? '#ffffff' : base;
  }, [selectedLink]);

  const legend = useMemo(() => Object.entries(RELATION_HEX), []);

  return (
    <div className="absolute inset-0 z-40 bg-bg-0 flex font-mono text-[12px]">
      <div className="flex-1 relative min-w-0" ref={wrapRef}>
        <div className="absolute top-0 left-0 right-0 p-3 z-10 flex items-center justify-between pointer-events-none">
          <div>
            <div className="text-[10px] tracking-[0.2em] text-text-3">KNOWLEDGE WEB</div>
            <div className="text-text-1 text-[14px]">{data.nodes.find(n => n.id === rootId)?.name ?? entityKey}</div>
            <div className="text-text-3">{data.nodes.length} entities · {data.links.length} relations · click a node to expand, an edge for evidence</div>
          </div>
          <button onClick={onClose} className="pointer-events-auto px-3 py-1.5 border border-line rounded text-text-2 hover:text-text-1 tracking-widest text-[11px]">CLOSE [ESC]</button>
        </div>
        {error && <div className="absolute inset-0 flex items-center justify-center text-err">{error}</div>}
        <ForceGraph2D
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={data}
          backgroundColor="#07090c"
          nodeCanvasObject={drawNode}
          nodePointerAreaPaint={(node: N, color, ctx) => { ctx.beginPath(); ctx.arc(node.x ?? 0, node.y ?? 0, 10, 0, 2 * Math.PI); ctx.fillStyle = color; ctx.fill(); }}
          linkColor={linkColor}
          linkWidth={(l: L) => Math.max(0.6, Math.min(5, (l.confidence ?? 0.2) * 4))}
          linkDirectionalParticles={0}
          linkHoverPrecision={10}
          onNodeClick={(n: N) => expand(n)}
          onNodeHover={(n: N | null) => setHover(n)}
          onLinkClick={(l: L) => showEvidence(l)}
          cooldownTicks={120}
          d3VelocityDecay={0.3}
          onEngineStop={() => fgRef.current?.zoomToFit(400, 60)}
        />
        <div className="absolute bottom-3 left-3 z-10 bg-bg-1/90 border border-line rounded p-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
          {legend.map(([k, hex]) => (
            <span key={k} className="flex items-center gap-1 text-text-2"><span className="inline-block w-3 h-0.5" style={{ background: hex }} />{k.toLowerCase()}</span>
          ))}
          {Object.entries(KIND_HEX).filter(([k]) => k !== 'UNKNOWN').map(([k, hex]) => (
            <span key={k} className="flex items-center gap-1 text-text-2"><span className="inline-block w-2 h-2 rounded-full" style={{ background: hex }} />{k.toLowerCase()}</span>
          ))}
        </div>
      </div>

      {/* Evidence panel */}
      {selectedLink && (
        <aside className="w-[380px] border-l border-line bg-bg-1 flex flex-col">
          <div className="px-3 py-2 border-b border-line flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] tracking-[0.2em] text-text-3">EVIDENCE</div>
              <div className="text-text-1">{evidence ? `${evidence.a.name} ↔ ${evidence.b.name}` : '…'}</div>
              <div className="text-text-3 text-[11px]">{selectedLink.label}{selectedLink.event_count ? ` · ${selectedLink.event_count} events` : ''}</div>
            </div>
            <button onClick={() => { setSelectedLink(null); setEvidence(null); }} className="text-text-3 hover:text-text-1 p-1"><X size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3">
            {evidence?.relations.map((r, i) => (
              <div key={i} className="text-text-2 border border-line rounded px-2 py-1">
                <span style={{ color: RELATION_HEX[r.kind] }}>{r.kind}</span> · {r.label ?? r.source}
                {r.source === 'wikidata' ? <span className="text-text-3"> · Wikidata fact</span>
                  : <span className="text-text-3"> · {r.event_count} events · {zuluDateTime(r.first_seen)} → {zuluDateTime(r.last_seen)}</span>}
              </div>
            ))}
            {evidence?.events.map(e => (
              <div key={e.event_id} className="border border-line rounded px-2 py-1.5">
                <div className="flex items-center justify-between text-[10px] text-text-3">
                  <span>{zuluShort(e.event_time)} · {e.source_id ?? e.origin}</span>
                  <span className={e.tone != null && e.tone < 0 ? 'text-prio-high' : 'text-ok'}>{e.action}</span>
                </div>
                <div className="text-text-2">{e.actor} → {e.target}</div>
                {e.quote && <div className="text-text-3 italic text-[11px] mt-0.5">“{e.quote}”</div>}
                {e.content_headline && <div className="text-text-3 text-[10px] mt-0.5 truncate">{e.content_headline}</div>}
                {e.source_url && <a href={e.source_url} target="_blank" rel="noreferrer" className="text-accent text-[10px] inline-flex items-center gap-1"><ExternalLink size={9} /> source</a>}
              </div>
            ))}
            {evidence && evidence.events.length === 0 && evidence.shared_reports.length > 0 && (
              <div>
                <div className="text-[10px] tracking-[0.2em] text-text-3 mb-1">MENTIONED TOGETHER IN</div>
                {evidence.shared_reports.map(s => <div key={s.uid} className="text-text-2 truncate">{zuluShort(s.created_at)} · {s.content_headline}</div>)}
              </div>
            )}
            {evidence && (
              <div className="flex gap-2 pt-2 border-t border-line">
                <button onClick={() => onOpenEntity(evidence.a.entity_id)} className="px-2 py-1 border border-line rounded text-text-2 hover:text-text-1 flex items-center gap-1"><Plus size={10} /> {evidence.a.name}</button>
                <button onClick={() => onOpenEntity(evidence.b.entity_id)} className="px-2 py-1 border border-line rounded text-text-2 hover:text-text-1 flex items-center gap-1"><Plus size={10} /> {evidence.b.name}</button>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
};

export default WebView;
