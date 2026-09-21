import React, { useEffect, useMemo, useState } from 'react';
import { X, ExternalLink, Globe, Share2, TrendingUp, TrendingDown, Plus, Crosshair } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { zuluDateTime, zuluShort } from '../../lib/format';
import { KIND_HEX, RELATION_HEX } from '../../lib/symbology';
import { VerdictBadge } from '../web/verdict';
import { modalityPrefix } from '../web/modality';
import type { EntityCard, KgEvent, RelationKind } from '../../lib/types';

interface Props {
  entityKey: string;
  onClose: () => void;
  onOpenEntity: (key: string) => void;
  onOpenReport: (uid: string) => void;
  onOpenWeb: (key: string) => void;
  onFlyTo?: (lon: number, lat: number) => void;
  /** When the web is open: expand this entity's neighbours / re-root the web on it. */
  web?: { expand: (id: string) => void; focus: (id: string) => void; rootId: string | null };
}

const ORDER: RelationKind[] = ['HOSTILE', 'COOPERATIVE', 'ROLE', 'OWNERSHIP', 'MEMBERSHIP', 'LOCATED', 'MENTIONED_WITH'];

/** The "who is who" card: identity, trend, connections by kind, recent events and reports. */
/** 30 days of the entity's article-read events: one dot per event, colour = stance, hover = the words. */
const TimelineStrip: React.FC<{ events: NonNullable<EntityCard['timeline']>; now: number }> = ({ events, now }) => {
  const days = 30;
  const cols = useMemo(() => {
    const c: (typeof events)[] = Array.from({ length: days }, () => []);
    events.forEach(e => {
      const d = Math.floor((now - Date.parse(e.event_time)) / 86_400_000);
      if (d >= 0 && d < days) c[days - 1 - d].push(e);
    });
    return c;
  }, [events, now]);
  const hex = (e: (typeof events)[number]) => (e.stance ?? 0) <= -1 ? RELATION_HEX.HOSTILE : (e.stance ?? 0) >= 1 ? RELATION_HEX.COOPERATIVE : '#9aa3ad';
  return (
    <div>
      <div className="text-[10px] tracking-[0.2em] text-text-3 mb-1">LAST 30 DAYS · {events.length} event{events.length === 1 ? '' : 's'}</div>
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${days}, 1fr)` }}>
        {cols.map((col, i) => (
          <div key={i} className="h-7 rounded-sm bg-bg-2 flex flex-col-reverse items-stretch gap-[1px] p-[1px]" title={`${days - 1 - i} day${days - 1 - i === 1 ? '' : 's'} ago · ${col.length} event${col.length === 1 ? '' : 's'}${col.slice(0, 3).map(e => `\n${e.actor} — ${modalityPrefix(e.modality)}${e.predicate} — ${e.target ?? ''}`).join('')}`}>
            {col.slice(0, 6).map(e => <span key={e.event_id} className="h-[3px] rounded-sm" style={{ background: hex(e), opacity: e.verifier_verdict === 'yes' ? 1 : 0.45 }} />)}
          </div>
        ))}
      </div>
    </div>
  );
};

/** "27 attacks reported (bbc.co.uk, gdelt) since 12 Sep" — the sentence behind a connection. */
function relationSentence(r: { source: string; label: string | null; event_count: number; weight: number; first_seen: string | null; sources?: string[]; actions?: string[]; topics?: { topic: string; count: number }[]; verified_topics?: { topic: string; count: number }[]; verified_count?: number; wire_count?: number }): string {
  if (r.source === 'wikidata') return `${r.label ?? 'fact'}${r.weight < 1 ? ' · former' : ''} · Wikidata`;
  if (r.source === 'cooccurrence') return `mentioned together in ${r.event_count} report${r.event_count === 1 ? '' : 's'}`;
  const since = r.first_seen ? ` since ${new Date(r.first_seen).toISOString().slice(5, 10).replace('-', '/')}` : '';
  const src = r.sources && r.sources.length ? ` (${r.sources.slice(0, 3).join(', ')}${r.sources.length > 3 ? ', …' : ''})` : '';
  // "diplomacy (12 verified · 40 wire)" — what an article said first, the wire count beside it
  const v = r.verified_count ?? 0, w = r.wire_count ?? 0;
  const topics = ((v > 0 ? r.verified_topics : r.topics) ?? []).filter(t => t.topic !== 'other');
  const counts = v > 0 ? `${v} verified${w ? ` · ${w} wire` : ''}` : `${w || r.event_count} wire only`;
  if (topics.length) {
    const what = topics.slice(0, 3).map(t => `${t.topic.replace('_', ' ')} (${t.count})`).join(' · ');
    return `${what} — ${counts}${src}${since}`;
  }
  const what = (r.actions && r.actions.length ? r.actions.map(a => a.toLowerCase().replace('_', ' ')).slice(0, 3).join('/') : r.label ?? 'event');
  return `${what} — ${counts}${src}${since}`;
}

const EntityInspector: React.FC<Props> = ({ entityKey, onClose, onOpenEntity, onOpenReport, onOpenWeb, onFlyTo, web }) => {
  const [card, setCard] = useState<EntityCard | null>(null);
  const [events, setEvents] = useState<KgEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) { setCard(null); setEvents([]); setError(null); } });
    apiFetch<EntityCard>(`/api/v1/kg/entities/${encodeURIComponent(entityKey)}`).then(r => {
      if (cancelled) return;
      if (r.status === 'success' && r.data) {
        setCard(r.data);
        apiFetch<KgEvent[]>(`/api/v1/kg/entities/${r.data.entity_id}/events?limit=30`).then(e => {
          if (!cancelled && e.status === 'success' && e.data) setEvents(e.data);
        });
      } else setError(r.message || 'Not in the knowledge web');
    });
    return () => { cancelled = true; };
  }, [entityKey]);

  const [loadedAt, setLoadedAt] = useState(0);
  useEffect(() => { if (card) setLoadedAt(Date.now()); }, [card]);
  const trendUp = card?.trend ? card.trend.last_7d > card.trend.prev_7d : false;

  return (
    <div className="h-full flex flex-col font-mono text-[12px]">
      <div className="px-3 py-2 border-b border-line flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] tracking-[0.2em]" style={{ color: KIND_HEX[card?.kind ?? 'UNKNOWN'] }}>
            {card?.kind ?? 'ENTITY'}{card?.qid ? ` · ${card.qid}` : ''}
          </div>
          <div className="text-text-1 text-[14px] leading-tight">{card?.name ?? entityKey}</div>
          {card?.description && <div className="text-text-3 leading-snug mt-0.5">{card.description}</div>}
        </div>
        <button onClick={onClose} className="text-text-3 hover:text-text-1 p-1"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-4">
        {error && <div className="text-err">{error}</div>}
        {card && (
          <>
            <div className="flex flex-wrap gap-2">
              {web ? (
                <>
                  <button onClick={() => web.expand(card.entity_id)} className="px-2 py-1 border border-accent rounded text-text-1 hover:bg-accent/20 flex items-center gap-1"><Plus size={11} /> expand</button>
                  {web.rootId !== card.entity_id && <button onClick={() => web.focus(card.entity_id)} className="px-2 py-1 border border-line rounded text-text-2 hover:text-text-1 hover:border-accent flex items-center gap-1"><Crosshair size={11} /> focus here</button>}
                </>
              ) : (
                <button onClick={() => onOpenWeb(card.entity_id)} className="px-2 py-1 border border-line rounded text-text-2 hover:text-text-1 hover:border-accent flex items-center gap-1"><Share2 size={11} /> web</button>
              )}
              {card.geo && onFlyTo && <button onClick={() => onFlyTo(card.geo!.lon, card.geo!.lat)} className="px-2 py-1 border border-line rounded text-text-2 hover:text-text-1 hover:border-accent flex items-center gap-1"><Globe size={11} /> globe</button>}
              {card.wikidata_url && <a href={card.wikidata_url} target="_blank" rel="noreferrer" className="px-2 py-1 border border-line rounded text-text-2 hover:text-text-1 flex items-center gap-1"><ExternalLink size={11} /> wikidata</a>}
            </div>

            {card.brief && (
              <section className="border border-line rounded px-2.5 py-2 bg-bg-2/60">
                <h3 className="text-[10px] tracking-[0.2em] text-text-3 mb-1">WHAT IS HAPPENING <span className="text-text-3/70">· from verified quotes · {zuluDateTime(card.brief.generated_at)}</span></h3>
                <p className="text-text-1 leading-snug text-[12px]">{card.brief.text}</p>
              </section>
            )}
            {card.timeline && card.timeline.length > 0 && <TimelineStrip events={card.timeline} now={loadedAt} />}
            {card.listings && card.listings.length > 0 && (
              <section className="border border-prio-critical/40 rounded px-2.5 py-2">
                <h3 className="text-[10px] tracking-[0.2em] text-prio-critical mb-1">LISTS · {card.listings.length}</h3>
                <ul className="space-y-0.5">
                  {card.listings.slice(0, 8).map((l, i) => (
                    <li key={i} className="text-[11px] text-text-2 truncate">
                      <span className="text-text-1">{l.list}</span>{l.program ? ` · ${l.program}` : ''}{l.since ? ` · since ${l.since}` : ''}{l.until ? ` → ${l.until}` : ''}
                      {l.url && <a href={l.url} target="_blank" rel="noreferrer" className="text-accent ml-1">source</a>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <dl className="grid grid-cols-[84px_1fr] gap-y-1 text-text-2">
              <dt className="text-text-3">MENTIONS</dt>
              <dd className="flex items-center gap-2">{card.mention_count}
                {card.trend && (
                  <span className={trendUp ? 'text-warn' : 'text-text-3'} title="last 7 days vs previous 7 days">
                    {trendUp ? <TrendingUp size={11} className="inline" /> : <TrendingDown size={11} className="inline" />} {card.trend.last_7d} / {card.trend.prev_7d}
                  </span>
                )}
              </dd>
              <dt className="text-text-3">SEEN</dt><dd>{zuluDateTime(card.first_seen)} → {zuluDateTime(card.last_seen)}</dd>
              {card.external_ids && card.external_ids.length > 0 && (
                <><dt className="text-text-3">IDS</dt><dd className="text-text-3 truncate">{card.external_ids.filter(x => x.kind !== 'ftm').slice(0, 6).map(x => `${x.kind} ${x.external_id.replace(/^[a-z]+:/, '')}`).join(' · ') || `${card.external_ids.length} registry id${card.external_ids.length === 1 ? '' : 's'}`}</dd></>
              )}
              {card.aliases.length > 1 && <><dt className="text-text-3">ALIASES</dt><dd className="text-text-3">{card.aliases.slice(0, 8).map(a => a.alias).join(' · ')}</dd></>}
              {Object.keys(card.event_counts).length > 0 && (
                <><dt className="text-text-3">ACTIONS</dt><dd className="text-text-3">{Object.entries(card.event_counts).map(([k, n]) => `${k.toLowerCase()} ${n}`).join(' · ')}</dd></>
              )}
            </dl>

            <section>
              <h3 className="text-[10px] tracking-[0.2em] text-text-3 mb-1">CONNECTIONS</h3>
              {ORDER.filter(k => card.relations[k]?.length).length === 0 && <div className="text-text-3">None yet.</div>}
              {ORDER.map(k => {
                const rows = card.relations[k];
                if (!rows || rows.length === 0) return null;
                return (
                  <div key={k} className="mb-2">
                    <div className="text-[10px] tracking-widest mb-0.5" style={{ color: RELATION_HEX[k] }}>{k} · {rows.length}</div>
                    <ul className="divide-y divide-line border border-line rounded">
                      {rows.slice(0, 12).map((r, i) => (
                        <li key={`${k}-${r.entity_id}-${r.source}-${i}`}>
                          <button onClick={() => onOpenEntity(r.entity_id)} className="w-full text-left px-2 py-1 hover:bg-bg-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-text-1"><span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ background: KIND_HEX[r.kind] }} />{r.name}</span>
                              <span className="text-text-3 shrink-0 text-[10px]">{r.kind}</span>
                            </div>
                            {r.why ? (
                              <>
                                <div className="text-[11px] text-text-2 truncate">
                                  {r.why.outgoing === false ? `${r.name} — ` : ''}<span style={{ color: RELATION_HEX[k] }}>{modalityPrefix(r.why.modality)}{r.why.predicate}</span>{r.why.outgoing === false ? '' : ` — ${r.name}`}
                                  <VerdictBadge verdict={r.why.verdict} />
                                  {(r.verified_count ?? 0) > 1 && <span className="text-text-3"> · {r.verified_count} verified</span>}
                                  {(r.wire_count ?? 0) > 0 && <span className="text-text-3"> · {r.wire_count} wire</span>}
                                </div>
                                {r.why.quote && <div className="text-[10px] text-text-3 italic truncate">“{r.why.quote}”</div>}
                              </>
                            ) : r.source === 'connector' ? (
                              <div className="text-[10px] text-text-3 truncate">
                                <span className="text-text-2">{r.label}</span> · {r.via_source ?? 'registry'}{r.first_seen ? ` · ${r.first_seen.slice(0, 10)}` : ''}{r.last_seen ? ` → ${r.last_seen.slice(0, 10)}` : ''}
                                {r.properties && typeof r.properties.reason === 'string' && r.properties.reason ? ` · ${(r.properties.reason as string).slice(0, 80)}` : ''}
                                {r.record_ref && /^https?:\/\//.test(r.record_ref) && (
                                  <a href={r.record_ref} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                                    className="ml-1 text-accent hover:underline" title={r.record_ref}>source ↗</a>
                                )}
                              </div>
                            ) : (
                              <div className="text-[10px] text-text-3 truncate">{relationSentence(r)}</div>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </section>

            {events.length > 0 && (
              <section>
                <h3 className="text-[10px] tracking-[0.2em] text-text-3 mb-1">EVENTS</h3>
                <ul className="space-y-1">
                  {events.slice(0, 12).map(e => (
                    <li key={e.event_id} className="border border-line rounded px-2 py-1">
                      <div className="flex items-center justify-between text-[10px] text-text-3">
                        <span>{zuluShort(e.event_time)} · {e.source_id ?? e.origin}</span>
                        <span className={e.tone != null && e.tone < 0 ? 'text-prio-high' : 'text-text-3'}>{e.action}</span>
                      </div>
                      <div className="text-text-2 truncate">{e.actor} → {e.target ?? (e.location ? `@ ${e.location}` : '')}</div>
                      {e.quote && <div className="text-text-3 italic text-[11px] line-clamp-2">“{e.quote}”</div>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {card.recent_reports.length > 0 && (
              <section>
                <h3 className="text-[10px] tracking-[0.2em] text-text-3 mb-1">REPORTS</h3>
                <ul className="divide-y divide-line border border-line rounded">
                  {card.recent_reports.slice(0, 10).map(r => (
                    <li key={r.report_uid}>
                      <button onClick={() => onOpenReport(r.report_uid)} className="w-full text-left px-2 py-1 hover:bg-bg-2">
                        <div className="text-text-1 truncate">{r.content_headline}</div>
                        <div className="text-[10px] text-text-3">{zuluShort(r.created_at)} · {r.source_id} · as “{r.surface}”</div>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EntityInspector;
