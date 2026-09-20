import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Crosshair, Trash2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { toMissionIn } from '../../lib/missions';
import type { EntitySummary, Mission, MissionIn } from '../../lib/types';

interface Props {
  mission: Mission | null;                                   // null = new
  currentBbox: () => number[] | null;                        // [minLon, minLat, maxLon, maxLat] of the globe view
  onSave: (body: MissionIn, id?: string) => Promise<{ status: string; message?: string }>;
  onDelete?: (id: string) => Promise<boolean>;
  onClose: () => void;
}

interface Options { topics: { topic: string; n: number }[]; sources: { source_id: string; label: string; kind: string; trust: number }[] }
interface Pick { id: string; name: string }

/** Small entity search that returns picks of one kind (countries) or any kind (watchlist). */
function EntityPicker({ label, kind, picks, onChange, hint }: { label: string; kind?: 'COUNTRY'; picks: Pick[]; onChange: (p: Pick[]) => void; hint: string }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<EntitySummary[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const search = (value: string) => {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    if (!value.trim()) { setHits([]); return; }
    timer.current = setTimeout(async () => {
      const r = await apiFetch<EntitySummary[]>(`/api/v1/kg/search?q=${encodeURIComponent(value.trim())}&limit=12`);
      const rows = r.status === 'success' && r.data ? r.data : [];
      setHits(kind ? rows.filter(h => h.kind === kind) : rows);
    }, 180);
  };
  const add = (h: EntitySummary) => {
    const id = kind === 'COUNTRY' ? (h.qid ?? h.entity_id) : h.entity_id;
    if (!picks.some(p => p.id === id)) onChange([...picks, { id, name: h.name }]);
    setQ(''); setHits([]);
  };
  return (
    <div>
      <div className="text-text-3 tracking-widest text-[10px] mb-1">{label}</div>
      <div className="flex flex-wrap gap-1 mb-1">
        {picks.map(p => (
          <span key={p.id} className="px-1.5 py-0.5 rounded border border-line bg-bg-0 text-text-1 flex items-center gap-1">
            {p.name}<button type="button" onClick={() => onChange(picks.filter(x => x.id !== p.id))} className="text-text-3 hover:text-err"><X size={10} /></button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input value={q} onChange={e => search(e.target.value)} placeholder={hint} autoComplete="off"
          className="w-full bg-bg-0 border border-line text-text-1 px-2 py-1 rounded focus:outline-none focus:border-accent" />
        {hits.length > 0 && (
          <ul className="absolute top-full mt-1 left-0 w-full bg-bg-1 border border-line rounded shadow-xl z-50 max-h-48 overflow-auto">
            {hits.map(h => (
              <li key={h.entity_id}>
                <button type="button" onClick={() => add(h)} className="w-full text-left px-2 py-1 hover:bg-bg-2 flex justify-between gap-2">
                  <span className="truncate text-text-1">{h.name}</span><span className="text-text-3 shrink-0">{h.kind}{h.qid ? ` · ${h.qid}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Create or edit a mission: what to collect first, whom to watch, where, which topics, when to alert. */
const MissionEditor: React.FC<Props> = ({ mission, currentBbox, onSave, onDelete, onClose }) => {
  const base = useMemo<MissionIn>(() => mission ? toMissionIn(mission) : {
    name: '', description: '', countries: [], languages: ['en'], feeds: [], sources: [], watchlist: [], topics: [],
    alert_rules: { watchlist_hostile: true, watchlist_pair: true, new_entity_in_area: 3 }, default_view: {}, model: null, bbox: null,
  }, [mission]);
  const [form, setForm] = useState<MissionIn>(base);
  const [countries, setCountries] = useState<Pick[]>(() => (mission?.countries ?? []).map((q, i) => ({ id: q, name: mission?.country_names?.[i] ?? q })));
  const [watch, setWatch] = useState<Pick[]>(() => (mission?.watchlist ?? []).map((id, i) => ({ id, name: mission?.watchlist_names?.[i] ?? id.slice(0, 8) })));
  const [feedsText, setFeedsText] = useState((mission?.feeds ?? []).join('\n'));
  const [options, setOptions] = useState<Options | null>(null);
  const [areaNote, setAreaNote] = useState<string>(mission?.area ? 'area set' : 'no area (world)');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { apiFetch<Options>('/api/v1/missions/options').then(r => { if (r.status === 'success' && r.data) setOptions(r.data); }); }, []);

  const set = <K extends keyof MissionIn>(k: K, v: MissionIn[K]) => setForm(f => ({ ...f, [k]: v }));
  const toggle = (list: string[], v: string) => list.includes(v) ? list.filter(x => x !== v) : [...list, v];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('A mission needs a name'); return; }
    setBusy(true); setError('');
    const body: MissionIn = { ...form, countries: countries.map(c => c.id), watchlist: watch.map(w => w.id),
      feeds: feedsText.split('\n').map(s => s.trim()).filter(Boolean) };
    const r = await onSave(body, mission?.mission_id);
    setBusy(false);
    if (r.status === 'success') onClose(); else setError(r.message || 'Could not save');
  };

  return (
    <div className="w-[520px] max-h-[80vh] overflow-auto bg-bg-1 border border-line rounded shadow-xl font-mono text-[12px]">
      <div className="px-3 py-2 border-b border-line flex items-center justify-between sticky top-0 bg-bg-1">
        <span className="tracking-[0.2em] text-text-2 flex items-center gap-2"><Crosshair size={13} /> {mission ? 'EDIT MISSION' : 'NEW MISSION'}</span>
        <button onClick={onClose} className="text-text-3 hover:text-text-1"><X size={14} /></button>
      </div>
      <form onSubmit={submit} className="p-3 flex flex-col gap-3">
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <div>
            <div className="text-text-3 tracking-widest text-[10px] mb-1">NAME</div>
            <input value={form.name} onChange={e => set('name', e.target.value)} disabled={mission?.name === 'General'}
              className="w-full bg-bg-0 border border-line text-text-1 px-2 py-1 rounded focus:outline-none focus:border-accent disabled:opacity-50" />
          </div>
          <div>
            <div className="text-text-3 tracking-widest text-[10px] mb-1">WHAT THIS MISSION IS ABOUT</div>
            <input value={form.description ?? ''} onChange={e => set('description', e.target.value)} placeholder="one line"
              className="w-full bg-bg-0 border border-line text-text-1 px-2 py-1 rounded focus:outline-none focus:border-accent" />
          </div>
        </div>

        <EntityPicker label="COUNTRIES (anything of theirs counts)" kind="COUNTRY" picks={countries} onChange={setCountries} hint="type a country…" />
        <EntityPicker label="WATCHLIST (people, groups, companies, countries — alerts follow them)" picks={watch} onChange={setWatch} hint="type a name…" />

        <div>
          <div className="text-text-3 tracking-widest text-[10px] mb-1">AREA</div>
          <div className="flex items-center gap-2">
            <span className="text-text-2">{areaNote}</span>
            <button type="button" onClick={() => { const b = currentBbox(); if (b) { set('bbox', b); setAreaNote(`current view (${b.map(x => x.toFixed(1)).join(', ')})`); } }}
              className="px-2 py-0.5 rounded border border-line text-text-2 hover:text-text-1 hover:border-accent">use current globe view</button>
            <button type="button" onClick={() => { set('bbox', []); setAreaNote('no area (world)'); }}
              className="px-2 py-0.5 rounded border border-line text-text-3 hover:text-text-1">clear</button>
          </div>
        </div>

        <div>
          <div className="text-text-3 tracking-widest text-[10px] mb-1">TOPICS (leave empty for all)</div>
          <div className="flex flex-wrap gap-1">
            {(options?.topics ?? []).map(t => (
              <button type="button" key={t.topic} onClick={() => set('topics', toggle(form.topics, t.topic))}
                className={`px-1.5 py-0.5 rounded border ${form.topics.includes(t.topic) ? 'border-accent text-text-1 bg-accent/10' : 'border-line text-text-3 hover:text-text-1'}`}>
                {t.topic}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-text-3 tracking-widest text-[10px] mb-1">FEEDS READ FIRST (RSS, one per line)</div>
          <textarea value={feedsText} onChange={e => setFeedsText(e.target.value)} rows={3} placeholder="https://…/rss.xml"
            className="w-full bg-bg-0 border border-line text-text-1 px-2 py-1 rounded focus:outline-none focus:border-accent" />
        </div>

        {options && options.sources.length > 0 && (
          <div>
            <div className="text-text-3 tracking-widest text-[10px] mb-1">DATABASES</div>
            <div className="flex flex-wrap gap-1">
              {options.sources.map(s => (
                <button type="button" key={s.source_id} onClick={() => set('sources', toggle(form.sources, s.source_id))} title={`${s.kind} · trust ${s.trust}`}
                  className={`px-1.5 py-0.5 rounded border ${form.sources.includes(s.source_id) ? 'border-accent text-text-1 bg-accent/10' : 'border-line text-text-3 hover:text-text-1'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="text-text-3 tracking-widest text-[10px] mb-1">ALERT WHEN</div>
          <label className="flex items-center gap-2 text-text-2"><input type="checkbox" checked={!!form.alert_rules.watchlist_hostile}
            onChange={e => set('alert_rules', { ...form.alert_rules, watchlist_hostile: e.target.checked })} /> a watchlist entity is in a verified hostile event</label>
          <label className="flex items-center gap-2 text-text-2"><input type="checkbox" checked={!!form.alert_rules.watchlist_pair}
            onChange={e => set('alert_rules', { ...form.alert_rules, watchlist_pair: e.target.checked })} /> two watchlist entities are linked for the first time</label>
          <label className="flex items-center gap-2 text-text-2">a new name appears in the area with at least
            <input type="number" min={0} max={50} value={form.alert_rules.new_entity_in_area ?? 0}
              onChange={e => set('alert_rules', { ...form.alert_rules, new_entity_in_area: Number(e.target.value) })}
              className="w-12 bg-bg-0 border border-line text-text-1 px-1 py-0.5 rounded" /> verified events (0 = off)</label>
        </div>

        {error && <div className="text-err">{error}</div>}
        <div className="flex items-center gap-2 pt-1 border-t border-line">
          {mission && onDelete && mission.name !== 'General' && (
            <button type="button" onClick={async () => { if (await onDelete(mission.mission_id)) onClose(); }}
              className="px-2 py-1 rounded border border-line text-text-3 hover:text-err hover:border-err flex items-center gap-1"><Trash2 size={12} /> delete</button>
          )}
          <span className="ml-auto" />
          <button type="button" onClick={onClose} className="px-2 py-1 rounded border border-line text-text-2 hover:text-text-1">cancel</button>
          <button type="submit" disabled={busy} className="px-3 py-1 rounded border border-accent text-text-1 bg-accent/10 hover:bg-accent/20 disabled:opacity-50">
            {busy ? 'saving…' : 'save'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MissionEditor;
