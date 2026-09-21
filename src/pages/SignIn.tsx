import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { apiFetch, setToken, clearToken } from '../lib/api';
import type { Me } from '../lib/session';

interface Props { onSignedIn: (me: Me) => void }

/** Paste a token (an admin mints it). It lives in this browser only. */
const SignIn: React.FC<Props> = ({ onSignedIn }) => {
  const [token, setTok] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true); setError('');
    setToken(token);
    const r = await apiFetch<Me>('/api/v1/me');
    setBusy(false);
    if (r.status === 'success' && r.data) onSignedIn(r.data);
    else { clearToken(); setError(r.code === 401 ? 'That token is not valid (or was revoked).' : r.message || 'Cannot reach the API'); }
  };

  return (
    <div className="h-screen w-screen bg-bg-0 text-text-1 flex items-center justify-center font-mono text-[12px]">
      <form onSubmit={submit} className="w-[380px] bg-bg-1 border border-line rounded shadow-xl p-5 flex flex-col gap-3">
        <div className="tracking-[0.3em] text-text-2 flex items-center gap-2"><KeyRound size={14} /> PIA · SIGN IN</div>
        <p className="text-text-3 leading-snug">Paste your access token. An admin mints one for you; it is kept in this browser only.</p>
        <input value={token} onChange={e => setTok(e.target.value)} placeholder="pia_…" autoFocus autoComplete="off" spellCheck={false}
          className="bg-bg-0 border border-line text-text-1 px-2 py-1.5 rounded focus:outline-none focus:border-accent" />
        {error && <div className="text-err">{error}</div>}
        <button type="submit" disabled={busy || !token.trim()}
          className="px-3 py-1.5 rounded border border-accent text-text-1 bg-accent/10 hover:bg-accent/20 disabled:opacity-50 tracking-widest">
          {busy ? 'CHECKING…' : 'ENTER'}
        </button>
      </form>
    </div>
  );
};

export default SignIn;
