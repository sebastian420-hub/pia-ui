import React, { useEffect, useState } from 'react';
import { X, ExternalLink, ArrowRight } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { zuluDateTime, zuluShort } from '../../lib/format';
import { RELATION_HEX } from '../../lib/symbology';
import type { RelationEvidence } from '../../lib/types';

interface Props {
  a: string;
  b: string;
  onClose: () => void;
  onOpenEntity: (key: string) => void;
}

/** Why two entities are connected: relations, the events with their quotes, shared reports. */
const EvidencePanel: React.FC<Props> = ({ a, b, onClose, onOpenEntity }) => {
  const [ev, setEv] = useState<RelationEvidence | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) { setEv(null); setError(null); } });
    apiFetch<RelationEvidence>(`/api/v1/kg/relations/${encodeURIComponent(a)}/${encodeURIComponent(b)}`).then(r => {
      if (cancelled) return;
      if (r.status === 'success' && r.data) setEv(r.data); else setError(r.message || 'No evidence found');
    });
    return () => { cancelled = true; };
  }, [a, b]);

  return (
    <div className="h-full flex flex-col font-mono text-[12px]">
      <div className="px-3 py-2 border-b border-line flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] tracking-[0.2em] text-text-3">EVIDENCE</div>
          <div className="text-text-1 text-[13px] leading-tight">
            {ev ? <>
              <button onClick={() => onOpenEntity(ev.a.entity_id)} className="hover:text-accent">{ev.a.name}</button>
              <span className="text-text-3"> ↔ </span>
              <button onClick={() => onOpenEntity(ev.b.entity_id)} className="hover:text-accent">{ev.b.name}</button>
            </> : '…'}
          </div>
        </div>
        <button onClick={onClose} className="text-text-3 hover:text-text-1 p-1"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3">
        {error && <div className="text-err">{error}</div>}
        {ev?.relations.map((r, i) => (
          <div key={i} className="border border-line rounded px-2 py-1.5">
            <span style={{ color: RELATION_HEX[r.kind] }}>{r.kind}</span>
            <span className="text-text-2"> · {r.label ?? r.source}</span>
            {r.source === 'wikidata'
              ? <div className="text-text-3 text-[11px]">Wikidata fact{r.weight < 1 ? ' · former' : ''}</div>
              : <div className="text-text-3 text-[11px]">
                  {r.event_count} event{r.event_count === 1 ? '' : 's'} · {zuluDateTime(r.first_seen)} → {zuluDateTime(r.last_seen)}
                  {r.topics && r.topics.length > 0 && (
                    <div className="mt-0.5 text-text-2">{r.topics.map(t => `${t.topic.replace('_', ' ')} ${t.count}`).join(' · ')}</div>
                  )}
                </div>}
          </div>
        ))}

        {ev && ev.events.length > 0 && (
          <section>
            <h3 className="text-[10px] tracking-[0.2em] text-text-3 mb-1">EVENTS</h3>
            <div className="space-y-1.5">
              {ev.events.map(e => (
                <div key={e.event_id} className="border border-line rounded px-2 py-1.5">
                  <div className="flex items-center justify-between text-[10px] text-text-3">
                    <span>{zuluShort(e.event_time)} · {e.source_id ?? e.origin}{e.topic && e.topic !== 'other' ? ` · ${e.topic.replace('_', ' ')}` : ''}</span>
                    <span className={e.tone != null && e.tone < 0 ? 'text-prio-high' : 'text-ok'}>{e.action.toLowerCase().replace('_', ' ')}</span>
                  </div>
                  <div className="text-text-2 flex items-center gap-1">{e.actor} <ArrowRight size={10} className="text-text-3" /> {e.target}</div>
                  {e.quote && <div className="text-text-3 italic text-[11px] mt-0.5">“{e.quote}”</div>}
                  {/* GDELT events carry no quote: the evidence is the headline, the outlet and the CAMEO code */}
                  {!e.quote && e.content_headline && <div className="text-text-2 text-[11px] mt-0.5">{e.content_headline}</div>}
                  {e.quote && e.content_headline && <div className="text-text-3 text-[10px] mt-0.5 truncate">{e.content_headline}</div>}
                  {e.coded_as && <div className="text-text-3 text-[10px] mt-0.5">coded by {e.coded_as}</div>}
                  {e.source_url && <a href={e.source_url} target="_blank" rel="noreferrer" className="text-accent text-[10px] inline-flex items-center gap-1"><ExternalLink size={9} /> source</a>}
                </div>
              ))}
            </div>
          </section>
        )}

        {ev && ev.shared_reports.length > 0 && (
          <section>
            <h3 className="text-[10px] tracking-[0.2em] text-text-3 mb-1">MENTIONED TOGETHER IN</h3>
            {ev.shared_reports.map(s => <div key={s.uid} className="text-text-2 truncate">{zuluShort(s.created_at)} · {s.content_headline}</div>)}
          </section>
        )}
        {ev && ev.events.length === 0 && ev.shared_reports.length === 0 && ev.relations.every(r => r.source === 'wikidata') && (
          <div className="text-text-3">This connection comes from Wikidata only; no reports observed it yet.</div>
        )}
      </div>
    </div>
  );
};

export default EvidencePanel;
