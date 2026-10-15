import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../services/api';

// -------------------------------------------------------
// AuthContext
// Single source of truth for:
//   - who is logged in (user object)
//   - their JWT token
//   - their allowed tab routes (allowedTabs)
//
// KEY BEHAVIOUR:
//   On every app load/reload, if a token already exists in
//   localStorage, we re-fetch GET /api/tabs from the server.
//   This means any permission change by Super Admin takes
//   effect for the admin on their next page reload —
//   no logout/login cycle required.
//
//   Super Admin (roleId=1) and Student (roleId=3) skip the
//   API call — their access is unrestricted so we just
//   keep whatever is in localStorage (set at login).
// -------------------------------------------------------

const AuthContext = createContext(null);

// ── Helpers ─────────────────────────────────────────────
function readUser() {
  try {
    const s = localStorage.getItem('user');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function readTabs() {
  try {
    const s = localStorage.getItem('allowedTabs');
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

// ────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(readUser);
  const [token,       setToken]       = useState(() => localStorage.getItem('token') || null);
  const [allowedTabs, setAllowedTabs] = useState(readTabs);
  const [tabsReady,   setTabsReady]   = useState(false); // prevents flash of wrong sidebar

  // ── Re-fetch tabs on every app load for Admin (roleId=2) ──
  // Super Admin and Student are unrestricted — no need.
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser  = readUser();

    if (!storedToken || !storedUser) {
      setTabsReady(true);
      return;
    }

    // Only Admin (roleId=2) has DB-controlled tabs
    if (storedUser.roleId !== 2) {
      setTabsReady(true);
      return;
    }

    // Re-fetch from server — this reflects any SuperAdmin changes
    api.get('/api/tabs')
      .then(res => {
        if (res.data.success) {
          const freshRoutes = res.data.routes;
          setAllowedTabs(freshRoutes);
          localStorage.setItem('allowedTabs', JSON.stringify(freshRoutes));
        }
      })
      .catch(() => {
        // If fetch fails (network, expired token), keep cached tabs
        // The token expiry guard will redirect to login separately
      })
      .finally(() => {
        setTabsReady(true);
      });
  }, []); // ← runs exactly once on mount (every page load/reload)

  // ── login() — called after successful API auth ──────────
  const login = useCallback((userData, jwtToken, tabs = []) => {
    setUser(userData);
    setToken(jwtToken);
    setAllowedTabs(tabs);
    setTabsReady(true);

    localStorage.setItem('user',        JSON.stringify(userData));
    localStorage.setItem('token',       jwtToken);
    localStorage.setItem('firstName',   userData.firstName);
    localStorage.setItem('allowedTabs', JSON.stringify(tabs));
  }, []);

  // ── logout() ────────────────────────────────────────────
  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setAllowedTabs([]);
    setTabsReady(false);

    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('firstName');
    localStorage.removeItem('allowedTabs');

    window.location.href = '/login';
  }, []);

  // ── canAccessTab() ──────────────────────────────────────
  // Super Admin (1): all tabs allowed
  // Student     (3): all student tabs allowed
  // Admin       (2): check allowedTabs list (from DB)
  const canAccessTab = useCallback((route) => {
    if (!user) return false;
    if (user.roleId === 1) return true;
    if (user.roleId === 3) return true;
    return allowedTabs.includes(route);
  }, [user, allowedTabs]);

  const isLoggedIn   = Boolean(token && user);
  const isSuperAdmin = user?.roleId === 1;
  const isAdmin      = user?.roleId === 2;
  const isStudent    = user?.roleId === 3;

  const value = {
    user,
    token,
    allowedTabs,
    tabsReady,     // consumers can wait for this before rendering sidebar
    isLoggedIn,
    isSuperAdmin,
    isAdmin,
    isStudent,
    login,
    logout,
    canAccessTab,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
