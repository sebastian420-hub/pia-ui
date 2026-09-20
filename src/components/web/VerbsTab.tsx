import React, { useCallback, useEffect, useState } from 'react';
import { GitMerge, Check, X } from 'lucide-react';
import { apiFetch, apiJson } from '../../lib/api';
import { RELATION_HEX } from '../../lib/symbology';

interface Verb {
  verb_id: string; verb: string; family: string; default_stance: number; status: 'seed' | 'auto' | 'curated' | 'rejected';
  seen_count: number; examples: string[]; created_by: string; created_at: string; aliases: string[];
}

const FAMILIES = ['HOSTILE·force', 'HOSTILE·coercion', 'HOSTILE·sanction', 'HOSTILE·accusation', 'HOSTILE·threat',
  'COOPERATIVE·agreement', 'COOPERATIVE·aid', 'COOPERATIVE·support', 'COOPERATIVE·meeting',
  'NEUTRAL·role', 'NEUTRAL·ownership', 'NEUTRAL·statement'];
const familyHex = (f: string) => f.startsWith('HOSTILE') ? RELATION_HEX.HOSTILE : f.startsWith('COOPERATIVE') ? RELATION_HEX.COOPERATIVE : '#9aa3ad';

/**
 * The living verb catalogue. New verbs the reader created ("auto") are listed first with the
 * sentences that produced them; a person may rename, move, re-stance, merge or reject them —
 * nothing waits on this, the verbs are already in use.
 */
const VerbsTab: React.FC = () => {
  const [verbs, setVerbs] = useState<Verb[]>([]);
  const [onlyNew, setOnlyNew] = useState(true);
  const [rename, setRename] = useState<Record<string, string>>({});
  const load = useCallback(() => {
    apiFetch<Verb[]>(`/api/v1/kg/verbs${onlyNew ? '?status=auto' : ''}`).then(r => { if (r.status === 'success' && r.data) setVerbs(r.data); });
  }, [onlyNew]);
  useEffect(() => { load(); }, [load]);

  const act = async (id: string, body: Record<string, unknown>) => {
    const r = await apiJson(`/api/v1/kg/verbs/${id}`, body);
    if (r.status === 'success') load(); else alert(r.message);
  };

  const byFamily = FAMILIES.map(f => [f, verbs.filter(v => v.family === f)] as const).filter(([, vs]) => vs.length);

  return (
    <div className="p-4 space-y-4 max-w-5xl">
      <div className="flex items-center gap-3 text-text-3">
        <label className="flex items-center gap-1"><input type="checkbox" checked={onlyNew} onChange={e => setOnlyNew(e.target.checked)} /> only new (auto) verbs</label>
        <span>· {verbs.length} verbs</span>
      </div>
      {byFamily.length === 0 && <div className="text-text-3">No new verbs — the reader has been using the catalogue as it is.</div>}
      {byFamily.map(([family, vs]) => (
        <section key={family}>
          <h3 className="text-[10px] tracking-[0.2em] mb-1" style={{ color: familyHex(family) }}>{family} · {vs.length}</h3>
          <ul className="space-y-1">
            {vs.map(v => (
              <li key={v.verb_id} className="border border-line rounded bg-bg-1 px-3 py-2 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(420px,1fr)] gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-text-1 text-[13px]">{v.verb}</span>
                    <span className="text-text-3">stance {v.default_stance > 0 ? '+' : ''}{v.default_stance} · seen {v.seen_count} · {v.status}</span>
                  </div>
                  {v.aliases.length > 0 && <div className="text-text-3 text-[10px] truncate">also: {v.aliases.join(' · ')}</div>}
                  <ul className="mt-1 space-y-0.5">
                    {v.examples.slice(0, 3).map((ex, i) => <li key={i} className="text-text-3 truncate italic">“{ex}”</li>)}
                  </ul>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] min-w-0">
                  <select value={v.family} onChange={e => act(v.verb_id, { action: 'move', family: e.target.value })}
                    className="bg-bg-0 border border-line rounded px-1 py-1 text-text-2">
                    {FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select value={v.default_stance} onChange={e => act(v.verb_id, { action: 'stance', default_stance: Number(e.target.value) })}
                    className="bg-bg-0 border border-line rounded px-1 py-1 text-text-2" title="default stance">
                    {[-3, -2, -1, 0, 1, 2, 3].map(s => <option key={s} value={s}>{s > 0 ? `+${s}` : s}</option>)}
                  </select>
                  <input value={rename[v.verb_id] ?? ''} onChange={e => setRename(p => ({ ...p, [v.verb_id]: e.target.value }))} placeholder="rename to…"
                    className="bg-bg-0 border border-line rounded px-2 py-1 w-36 text-text-1 focus:outline-none focus:border-accent" />
                  <button onClick={() => rename[v.verb_id] && act(v.verb_id, { action: 'rename', verb: rename[v.verb_id] })} className="px-2 py-1 border border-line rounded text-text-2 hover:text-text-1">rename</button>
                  <select defaultValue="" onChange={e => e.target.value && act(v.verb_id, { action: 'merge', into: e.target.value })}
                    className="bg-bg-0 border border-line rounded px-1 py-1 text-text-2" title="merge into">
                    <option value="">merge into…</option>
                    {verbs.filter(o => o.verb_id !== v.verb_id && o.family === v.family).map(o => <option key={o.verb_id} value={o.verb_id}>{o.verb}</option>)}
                  </select>
                  {v.status === 'auto' && <button onClick={() => act(v.verb_id, { action: 'approve' })} className="px-2 py-1 border border-line rounded text-text-2 hover:text-ok flex items-center gap-1"><Check size={11} /> keep</button>}
                  <button onClick={() => act(v.verb_id, { action: 'reject' })} className="px-2 py-1 border border-line rounded text-text-2 hover:text-err flex items-center gap-1"><X size={11} /> reject</button>
                  <GitMerge size={11} className="text-text-3" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default VerbsTab;
