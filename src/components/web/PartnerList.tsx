import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { KIND_HEX, RELATION_HEX } from '../../lib/symbology';
import type { GraphNode } from '../../lib/types';
import type { Partner } from './wheelLayout';
import { modalityPrefix } from './modality';

interface Props {
  partners: Partner[];
  nodes: Map<string, GraphNode>;
  selectedId?: string | null;
  hoverId?: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onEvidence: (id: string) => void;
}

type SortKey = 'events' | 'name' | 'recent';

/** The same partners as the wheel, as a ranked table: who · what about · how much · when. */
const PartnerList: React.FC<Props> = ({ partners, nodes, selectedId, hoverId, onSelect, onHover, onEvidence }) => {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('events');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = partners
      .map(p => ({ p, n: nodes.get(p.id) }))
      .filter(r => r.n && (!needle || r.n.name.toLowerCase().includes(needle)));
    const lastSeen = (p: Partner) => Math.max(0, ...p.links.map(l => (l.last_seen ? Date.parse(l.last_seen) : 0)));
    list.sort((a, b) => {
      if (sort === 'name') return a.n!.name.localeCompare(b.n!.name);
      if (sort === 'recent') return lastSeen(b.p) - lastSeen(a.p);
      return b.p.verified - a.p.verified || b.p.events - a.p.events || b.p.weight - a.p.weight;   // verified first
    });
    return list;
  }, [partners, nodes, q, sort]);

  const topics = (p: Partner) => {
    const acc = new Map<string, number>();
    p.links.forEach(l => l.topics?.forEach(t => { if (t.topic !== 'other') acc.set(t.topic, (acc.get(t.topic) ?? 0) + t.count); }));
    return [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t, n]) => `${t.replace('_', ' ')} ${n}`).join(' · ');
  };
  /** The words of the strongest verified event, when the API has them. */
  const why = (p: Partner): string | undefined => {
    const l = p.links.find(x => x.why?.predicate);
    if (!l?.why) return undefined;
    return `${modalityPrefix(l.why.modality)}${l.why.predicate}${l.why.verdict === 'yes' ? '' : l.why.verdict ? ` (${l.why.verdict})` : ' (unchecked)'}`;
  };
  const factLabel = (p: Partner) => p.links.filter(l => l.origin === 'wikidata' || l.origin === 'connector').map(l => `${l.label}${l.origin === 'connector' && l.via_source ? ` (${l.via_source.replace('opensanctions_', 'OpenSanctions ')})` : ''}`).slice(0, 2).join(', ');

  return (
    <div className="w-[300px] shrink-0 border-r border-line flex flex-col min-h-0 bg-bg-1">
      <div className="px-2 py-1.5 border-b border-line flex items-center gap-2">
        <Search size={12} className="text-text-3" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="filter partners"
          className="flex-1 bg-transparent outline-none text-[12px] text-text-1 placeholder:text-text-3" />
        <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
          className="bg-bg-2 border border-line rounded text-[10px] text-text-2 px-1 py-0.5">
          <option value="events">by events</option>
          <option value="recent">by recent</option>
          <option value="name">by name</option>
        </select>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {rows.map(({ p, n }) => {
          const active = p.id === selectedId, hot = p.id === hoverId;
          const colour = p.hostile || p.cooperative ? RELATION_HEX[p.sector === 'hostile' ? 'HOSTILE' : 'COOPERATIVE'] : RELATION_HEX[p.sector === 'role' ? 'ROLE' : 'MEMBERSHIP'];
          return (
            <div key={p.id}
              onMouseEnter={() => onHover(p.id)} onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(p.id)}
              className={`px-2 py-1.5 border-b border-line/60 cursor-pointer ${active ? 'bg-bg-3' : hot ? 'bg-bg-2' : ''}`}>
              <div className="flex items-center gap-1.5 text-[12px]">
                <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: KIND_HEX[n!.group] ?? KIND_HEX.UNKNOWN }} />
                <span className="text-text-1 truncate flex-1">{n!.name}</span>
                {p.events > 0 && (
                  <button onClick={e => { e.stopPropagation(); onEvidence(p.id); }} title={`${p.verified} verified · ${p.wire} wire — click for evidence`}
                    className="font-mono text-[11px] px-1 rounded" style={{ color: colour, opacity: p.verified ? 1 : 0.55 }}>
                    {p.verified > 0 ? p.verified : `${p.wire}w`}
                  </button>
                )}
              </div>
              <div className="text-[10px] text-text-3 truncate pl-3.5">
                {p.events > 0
                  ? (why(p) ?? topics(p) ?? p.links.map(l => l.label).filter(Boolean).slice(0, 2).join(', '))
                  : factLabel(p) || 'Wikidata fact'}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="p-3 text-text-3 text-[11px]">No partners match.</div>}
      </div>
    </div>
  );
};

export default PartnerList;
