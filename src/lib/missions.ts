import { useCallback, useEffect, useState } from 'react';
import { apiFetch, apiJson } from './api';
import type { Mission, MissionIn } from './types';

export type MissionScope = 'mission' | 'all';

/**
 * The missions and which one is active. `query` is the string every data request appends:
 * empty for General (or "show all"), `&mission_id=…` for a narrowing mission.
 */
export function useMissions() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [scope, setScope] = useState<MissionScope>('mission');

  const refresh = useCallback(async () => {
    const r = await apiFetch<Mission[]>('/api/v1/missions');
    if (r.status === 'success' && r.data) setMissions(r.data);
  }, []);

  useEffect(() => {
    const t = setInterval(refresh, 60_000);
    const first = setTimeout(refresh, 0);
    return () => { clearInterval(t); clearTimeout(first); };
  }, [refresh]);

  const active = missions.find(m => m.is_active) ?? null;
  const narrowing = !!active && !active.is_general && scope === 'mission';
  const query = narrowing ? `&mission_id=${active!.mission_id}` : '';

  const activate = useCallback(async (id: string) => {
    const r = await apiJson(`/api/v1/missions/${id}/activate`, {});
    await refresh();
    return r.status === 'success';
  }, [refresh]);

  const save = useCallback(async (body: MissionIn, id?: string) => {
    const r = id ? await apiJson<Mission>(`/api/v1/missions/${id}`, body, 'PUT') : await apiJson<Mission>('/api/v1/missions', body);
    await refresh();
    return r;
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    const r = await apiFetch(`/api/v1/missions/${id}`, { method: 'DELETE' });
    await refresh();
    return r.status === 'success';
  }, [refresh]);

  return { missions, active, scope, setScope, narrowing, query, refresh, activate, save, remove };
}

export function toMissionIn(m: Mission): MissionIn {
  return { name: m.name, description: m.description, countries: m.countries, languages: m.languages, feeds: m.feeds, sources: m.sources,
           watchlist: m.watchlist, topics: m.topics, alert_rules: m.alert_rules, default_view: m.default_view, model: m.model, bbox: null };
}
