import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, X, GitMerge } from 'lucide-react';
import { apiFetch, apiJson } from '../lib/api';
import { KIND_HEX } from '../lib/symbology';
import type { ReviewItem } from '../lib/types';

/** Names the resolver was not sure about. One click: merge into a Wikidata item, keep local, or reject. */
const Review: React.FC = () => {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [total, setTotal] = useState<number | null>(null);

  const load = useCallback(() => {
    apiFetch<ReviewItem[]>('/api/v1/kg/review?limit=100').then(r => {
      if (r.status === 'success' && r.data) { setItems(r.data); setTotal(r.total ?? r.data.length); }
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (id: string, decision: 'merge' | 'keep' | 'reject', qid?: string) => {
    const r = await apiJson(`/api/v1/kg/review/${id}`, { decision, qid });
    if (r.status === 'success') setItems(prev => prev.filter(i => i.entity_id !== id));
    else alert(r.message);
  };

  return (
    <div className="h-screen w-screen bg-bg-0 text-text-1 font-mono text-[12px] flex flex-col">
      <div className="h-10 flex items-center gap-3 px-4 border-b border-line bg-bg-1">
        <Link to="/" className="text-text-3 hover:text-text-1"><ArrowLeft size={16} /></Link>
        <span className="tracking-[0.2em] text-text-1">IDENTITY REVIEW</span>
        <span className="text-text-3">· {total ?? items.length} names waiting{total && total > items.length ? ` · showing ${items.length}` : ''}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 max-w-5xl">
        {loading && <div className="text-text-3">Loading…</div>}
        {!loading && items.length === 0 && <div className="text-text-3">Nothing to review. The resolver is confident about everything it has seen.</div>}
        {items.map(it => (
          <div key={it.entity_id} className="border border-line rounded bg-bg-1 p-3 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)] gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 rounded" style={{ background: KIND_HEX[it.kind], color: '#07090c' }}>{it.kind}</span>
                <span className="text-text-1 text-[13px]">{it.name}</span>
                <span className="text-text-3">· {it.mentions} mention{it.mentions === 1 ? '' : 's'} · {it.note}</span>
              </div>
              <ul className="mt-2 space-y-1">
                {it.examples.map((ex, i) => (
                  <li key={i} className="text-text-3 truncate">“{ex.surface}” — {ex.headline}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-1 min-w-0">
              {it.candidates.map(c => (
                <button key={c.qid} onClick={() => decide(it.entity_id, 'merge', c.qid)}
                  className="w-full text-left px-2 py-1 border border-line rounded hover:border-accent hover:bg-bg-2 flex items-center gap-2">
                  <GitMerge size={11} className="text-accent shrink-0" />
                  <span className="text-text-1">{c.name ?? c.qid}</span>
                  <span className="text-text-3 truncate">{c.kind ? `${c.kind} · ` : ''}{c.description ?? c.qid}</span>
                </button>
              ))}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input value={custom[it.entity_id] ?? ''} onChange={e => setCustom(p => ({ ...p, [it.entity_id]: e.target.value }))}
                  placeholder="Q-id…" className="bg-bg-0 border border-line rounded px-2 py-1 w-28 text-text-1 focus:outline-none focus:border-accent" />
                <button onClick={() => custom[it.entity_id] && decide(it.entity_id, 'merge', custom[it.entity_id].trim())}
                  className="px-2 py-1 border border-line rounded text-text-2 hover:text-text-1">merge</button>
                <button onClick={() => decide(it.entity_id, 'keep')} className="px-2 py-1 border border-line rounded text-text-2 hover:text-ok flex items-center gap-1"><Check size={11} /> keep local</button>
                <button onClick={() => decide(it.entity_id, 'reject')} className="px-2 py-1 border border-line rounded text-text-2 hover:text-err flex items-center gap-1"><X size={11} /> not an entity</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Review;
