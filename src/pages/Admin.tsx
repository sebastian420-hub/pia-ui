import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, Shield, Users, Database, ScrollText } from 'lucide-react';
import { apiFetch, apiJson } from '../lib/api';
import { useSession, type Role } from '../lib/session';

interface UserRow { user_id: string; name: string; email: string | null; role: Role; created_at: string; disabled_at: string | null; tokens: number; last_seen: string | null; grants: string[] | null }
interface SourceRow { source_id: string; label: string; kind: string; trust: number; visibility: 'public' | 'org' | 'restricted'; reports: number; events: number; granted_to: string[] | null }
interface AuditRow { id: number; at: string; user_name: string | null; action: string; object: string; detail: Record<string, unknown> }

type Tab = 'users' | 'sources' | 'audit';

/** Who is who on the system, what each source is worth showing to whom, and what happened. Admin only. */
const Admin: React.FC = () => {
  const { me, can } = useSession();
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [minted, setMinted] = useState<{ user: string; token: string } | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    apiFetch<UserRow[]>('/api/v1/users').then(r => { if (r.status === 'success' && r.data) setUsers(r.data); });
    apiFetch<SourceRow[]>('/api/v1/sources').then(r => { if (r.status === 'success' && r.data) setSources(r.data); });
    apiFetch<AuditRow[]>('/api/v1/audit?limit=200').then(r => { if (r.status === 'success' && r.data) setAudit(r.data); });
  }, []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  if (!can('admin')) {
    return <div className="h-screen bg-bg-0 text-text-2 font-mono text-[12px] p-6">Admin only. <a href="/" className="text-accent">← back</a></div>;
  }

  const say = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = e.target as HTMLFormElement;
    const name = (f.elements.namedItem('name') as HTMLInputElement).value.trim();
    const role = (f.elements.namedItem('role') as HTMLSelectElement).value;
    if (!name) return;
    const r = await apiJson('/api/v1/users', { name, role });
    if (r.status === 'success') { f.reset(); load(); } else say(r.message || 'failed');
  };
  const setRole = async (u: UserRow, role: Role) => {
    const r = await apiJson(`/api/v1/users/${u.user_id}`, { name: u.name, email: u.email, role }, 'PUT');
    if (r.status === 'success') load(); else say(r.message || 'failed');
  };
  const mint = async (u: UserRow) => {
    const r = await apiJson<{ token: string }>(`/api/v1/users/${u.user_id}/tokens`, { label: 'minted in admin' });
    if (r.status === 'success' && r.data) { setMinted({ user: u.name, token: r.data.token }); load(); } else say(r.message || 'failed');
  };
  const disable = async (u: UserRow) => {
    const r = await apiJson(`/api/v1/users/${u.user_id}/disable`, {});
    if (r.status === 'success') load(); else say(r.message || 'failed');
  };
  const setVisibility = async (s: SourceRow, visibility: string) => {
    const r = await apiJson(`/api/v1/sources/${encodeURIComponent(s.source_id)}/visibility`, { visibility }, 'PUT');
    if (r.status === 'success') load(); else say(r.message || 'failed');
  };
  const grant = async (s: SourceRow, userId: string) => {
    if (!userId) return;
    const r = await apiJson(`/api/v1/sources/${encodeURIComponent(s.source_id)}/grants`, { user_id: userId });
    if (r.status === 'success') load(); else say(r.message || 'failed');
  };
  const revokeGrant = async (s: SourceRow, name: string) => {
    const u = users.find(x => x.name === name);
    if (!u) return;
    const r = await apiFetch(`/api/v1/sources/${encodeURIComponent(s.source_id)}/grants/${u.user_id}`, { method: 'DELETE' });
    if (r.status === 'success') load(); else say(r.message || 'failed');
  };

  const tabBtn = (t: Tab, icon: React.ReactNode, label: string) => (
    <button onClick={() => setTab(t)} className={`flex items-center gap-1 px-2 py-1 rounded border ${tab === t ? 'border-accent text-text-1' : 'border-line text-text-3 hover:text-text-1'}`}>{icon}{label}</button>
  );

  return (
    <div className="h-screen w-screen bg-bg-0 text-text-1 font-mono text-[12px] flex flex-col">
      <div className="h-9 flex items-center gap-3 px-3 bg-bg-1 border-b border-line">
        <a href="/" className="text-text-3 hover:text-text-1 flex items-center gap-1"><ArrowLeft size={13} /> back</a>
        <span className="tracking-[0.2em] text-text-2 flex items-center gap-2"><Shield size={13} /> ADMIN</span>
        {tabBtn('users', <Users size={12} />, `users · ${users.length}`)}
        {tabBtn('sources', <Database size={12} />, `sources · ${sources.length}`)}
        {tabBtn('audit', <ScrollText size={12} />, 'audit')}
        <span className="ml-auto text-text-3">{me?.name} · {me?.role}</span>
        {msg && <span className="text-warn">{msg}</span>}
      </div>

      {minted && (
        <div className="m-3 p-3 border border-accent rounded bg-accent/10 flex items-center gap-3">
          <KeyRound size={14} />
          <span>Token for <b>{minted.user}</b> — shown once, copy it now:</span>
          <code className="select-all bg-bg-0 px-2 py-0.5 rounded">{minted.token}</code>
          <button onClick={() => setMinted(null)} className="ml-auto text-text-3 hover:text-text-1">done</button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-3">
        {tab === 'users' && (
          <div className="max-w-4xl">
            <form onSubmit={addUser} className="flex items-center gap-2 mb-3">
              <input name="name" placeholder="name" className="bg-bg-0 border border-line px-2 py-1 rounded w-48 focus:outline-none focus:border-accent" />
              <select name="role" className="bg-bg-0 border border-line px-2 py-1 rounded">
                <option value="viewer">viewer — reads</option>
                <option value="analyst">analyst — + review, missions, uploads</option>
                <option value="admin">admin — + users, sources, deletion</option>
              </select>
              <button className="px-2 py-1 rounded border border-line hover:border-accent">add user</button>
            </form>
            <table className="w-full text-left">
              <thead className="text-text-3 text-[10px] tracking-widest"><tr><th className="py-1">NAME</th><th>ROLE</th><th>TOKENS</th><th>LAST SEEN</th><th>GRANTS</th><th></th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id} className={`border-t border-line ${u.disabled_at ? 'opacity-40' : ''}`}>
                    <td className="py-1.5">{u.name}{u.email ? <span className="text-text-3"> · {u.email}</span> : null}{u.disabled_at ? <span className="text-err"> · disabled</span> : null}</td>
                    <td>
                      <select value={u.role} disabled={u.user_id === me?.user_id || !!u.disabled_at} onChange={e => setRole(u, e.target.value as Role)} className="bg-bg-0 border border-line px-1 py-0.5 rounded">
                        <option value="viewer">viewer</option><option value="analyst">analyst</option><option value="admin">admin</option>
                      </select>
                    </td>
                    <td>{u.tokens}</td>
                    <td className="text-text-3">{u.last_seen ? u.last_seen.slice(0, 16).replace('T', ' ') : '—'}</td>
                    <td className="text-text-3">{u.grants?.join(', ') || '—'}</td>
                    <td className="text-right">
                      {!u.disabled_at && <button onClick={() => mint(u)} className="px-2 py-0.5 rounded border border-line hover:border-accent mr-1">mint token</button>}
                      {!u.disabled_at && u.user_id !== me?.user_id && <button onClick={() => disable(u)} className="px-2 py-0.5 rounded border border-line text-text-3 hover:text-err hover:border-err">disable</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'sources' && (
          <div className="max-w-5xl">
            <p className="text-text-3 mb-2">A row is as visible as its source. <b>public</b> — everyone · <b>org</b> — any signed-in user · <b>restricted</b> — only the users granted below (and admins).</p>
            <table className="w-full text-left">
              <thead className="text-text-3 text-[10px] tracking-widest"><tr><th className="py-1">SOURCE</th><th>KIND</th><th>TRUST</th><th>ROWS</th><th>VISIBILITY</th><th>GRANTED TO</th></tr></thead>
              <tbody>
                {sources.map(s => (
                  <tr key={s.source_id} className={`border-t border-line ${s.visibility === 'restricted' ? 'bg-prio-critical/5' : ''}`}>
                    <td className="py-1.5">{s.label}<span className="text-text-3"> · {s.source_id}</span></td>
                    <td className="text-text-3">{s.kind}</td>
                    <td className="text-text-3">{s.trust.toFixed(2)}</td>
                    <td className="text-text-3">{s.reports} rep · {s.events} ev</td>
                    <td>
                      <select value={s.visibility} onChange={e => setVisibility(s, e.target.value)} className={`bg-bg-0 border px-1 py-0.5 rounded ${s.visibility === 'restricted' ? 'border-prio-critical text-prio-critical' : 'border-line'}`}>
                        <option value="public">public</option><option value="org">org</option><option value="restricted">restricted</option>
                      </select>
                    </td>
                    <td>
                      {s.visibility === 'restricted' ? (
                        <span className="flex items-center gap-1 flex-wrap">
                          {(s.granted_to ?? []).map(n => <span key={n} className="px-1.5 py-0.5 rounded border border-line">{n} <button onClick={() => revokeGrant(s, n)} className="text-text-3 hover:text-err">×</button></span>)}
                          <select value="" onChange={e => grant(s, e.target.value)} className="bg-bg-0 border border-line px-1 py-0.5 rounded">
                            <option value="">+ grant…</option>
                            {users.filter(u => !u.disabled_at && u.role !== 'admin' && !(s.granted_to ?? []).includes(u.name)).map(u => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
                          </select>
                        </span>
                      ) : <span className="text-text-3">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'audit' && (
          <table className="w-full text-left max-w-5xl">
            <thead className="text-text-3 text-[10px] tracking-widest"><tr><th className="py-1">WHEN</th><th>WHO</th><th>ACTION</th><th>OBJECT</th><th>DETAIL</th></tr></thead>
            <tbody>
              {audit.map(a => (
                <tr key={a.id} className="border-t border-line">
                  <td className="py-1 text-text-3 tabular-nums">{a.at.slice(0, 19).replace('T', ' ')}</td>
                  <td>{a.user_name ?? '—'}</td>
                  <td className={a.action === 'delete' ? 'text-err' : a.action === 'read_restricted' ? 'text-prio-critical' : 'text-text-2'}>{a.action}</td>
                  <td className="text-text-2">{a.object}</td>
                  <td className="text-text-3 truncate max-w-[360px]">{JSON.stringify(a.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Admin;
