import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import Archive from './pages/Archive';
import Review from './pages/Review';
import Admin from './pages/Admin';
import SignIn from './pages/SignIn';
import { apiFetch, clearToken, getToken } from './lib/api';
import { SessionContext, atLeast, type Me, type Role } from './lib/session';

function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(() => !getToken());   // no token in this browser: straight to sign-in

  // who am I? (the token in this browser, if any)
  useEffect(() => {
    if (checked) return;
    apiFetch<Me>('/api/v1/me').then(r => { if (r.status === 'success' && r.data) setMe(r.data); else clearToken(); setChecked(true); });
  }, [checked]);
  // a 401 anywhere (token revoked) sends the user back to sign in
  useEffect(() => {
    const h = () => { clearToken(); setMe(null); };
    window.addEventListener('pia:unauthorized', h);
    return () => window.removeEventListener('pia:unauthorized', h);
  }, []);

  const signOut = useCallback(() => { clearToken(); setMe(null); }, []);
  const session = useMemo(() => ({ me, can: (role: Role) => atLeast(me, role), signOut }), [me, signOut]);

  if (!checked) return null;
  if (!me) return <SignIn onSignedIn={setMe} />;

  return (
    <SessionContext.Provider value={session}>
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/review" element={<Review />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Router>
    </SessionContext.Provider>
  );
}

export default App;
