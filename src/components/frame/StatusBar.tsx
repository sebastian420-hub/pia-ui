import React, { useEffect, useState } from 'react';
import { Radio, Activity } from 'lucide-react';
import { apiFetch, apiJson } from '../../lib/api';
import { countdown, zuluTime, ago } from '../../lib/format';
import type { Health, LiveStatus } from '../../lib/types';

interface StatusBarProps {
  feedStatus: 'connecting' | 'live' | 'offline';
  alertCount: number;
  onLiveChange?: (active: boolean) => void;
  mission?: React.ReactNode;          // the mission switcher, owned by the page
}

/** 32 px top bar: banner · Zulu clock · feed · agents · alerts · GO LIVE meter. */
const StatusBar: React.FC<StatusBarProps> = ({ feedStatus, alertCount, onLiveChange, mission }) => {
  const [clock, setClock] = useState(zuluTime());
  const [health, setHealth] = useState<Health | null>(null);
  const [live, setLive] = useState<LiveStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => { setClock(zuluTime()); setTick(x => x + 1); }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = () => {
      apiFetch<Health>('/api/v1/health').then(r => { if (r.status === 'success' && r.data) setHealth(r.data); });
      apiFetch<LiveStatus>('/api/v1/live').then(r => { if (r.status === 'success' && r.data) setLive(r.data); });
    };
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [onLiveChange]);

  // Tell the parent when the live state flips (after render, never inside a state updater).
  const liveActive = live?.active ?? false;
  useEffect(() => { onLiveChange?.(liveActive); }, [liveActive, onLiveChange]);

  const toggleLive = async () => {
    if (!live || busy) return;
    setBusy(true);
    const r = live.active
      ? await apiJson('/api/v1/live/stop', {})
      : await apiJson('/api/v1/live/start', { minutes: 30 });
    setBusy(false);
    if (r.status === 'error') { console.error(r.message); return; }
    const s = await apiFetch<LiveStatus>('/api/v1/live');
    if (s.status === 'success' && s.data) setLive(s.data);
  };

  const feedColor = feedStatus === 'live' ? 'text-ok' : feedStatus === 'offline' ? 'text-err' : 'text-text-3';
  const agentsOk = health ? health.agents_alive === health.agents_total : false;
  void tick;

  return (
    <div className="h-8 flex items-center gap-4 px-3 bg-bg-1 border-b border-line font-mono text-[12px] text-text-2 select-none">
      <span className="tracking-[0.2em] text-text-1 font-semibold">UNCLASSIFIED // OSINT</span>
      <span className="text-text-3">·</span>
      {mission ?? <span>MISSION <span className="text-text-1">GENERAL</span></span>}

      <span className="ml-auto flex items-center gap-4">
        <span className={`flex items-center gap-1 ${feedColor}`} title="Live feed WebSocket">
          <Radio size={12} /> {feedStatus.toUpperCase()}
        </span>
        <span className={`flex items-center gap-1 ${agentsOk ? 'text-ok' : 'text-warn'}`} title={health?.agents.map(a => `${a.agent_name}: ${a.alive ? 'ok' : 'stale'} (${ago(a.age_seconds)})`).join('\n')}>
          <Activity size={12} /> AGENTS {health ? `${health.agents_alive}/${health.agents_total}` : '—'}
        </span>
        <span title="Queue backlog">QUEUE {health?.queue?.PENDING ?? 0}</span>
        <span className={alertCount > 0 ? 'text-prio-high' : ''} title="HIGH/CRITICAL in the last 24h">ALERTS {alertCount}</span>

        <button
          onClick={toggleLive}
          disabled={busy || !live || (!live.active && !live.relay_configured)}
          title={!live?.relay_configured ? 'No US relay configured (RELAY_URL) — on-demand cameras unavailable' : live.active ? 'Stop the live session' : 'Start a 30-minute live session (US relay)'}
          className={`px-2 py-0.5 rounded border text-[11px] tracking-widest transition-colors disabled:opacity-40 ${
            live?.active ? 'border-err text-err hover:bg-err/10' : 'border-line text-text-2 hover:border-accent hover:text-text-1'
          }`}
        >
          {live?.active && live.session ? `LIVE ${countdown(live.session.expires_at)} · $${live.estimated_cost_today_usd.toFixed(2)}` : 'GO LIVE'}
        </button>

        <span className="text-text-1 tabular-nums text-[13px] w-[84px] text-right">{clock}</span>
      </span>
    </div>
  );
};

export default StatusBar;
