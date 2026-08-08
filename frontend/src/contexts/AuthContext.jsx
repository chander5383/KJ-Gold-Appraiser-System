import { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

// Decode the exp field from a JWT without a library.
// Returns expiry as a ms timestamp, or null if the token is unreadable.
function jwtExp(token) {
  try {
    // Base64url → base64 → JSON
    const payload = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [token, setToken]   = useState(null);
  const [loading, setLoading] = useState(true);
  // Holds the auto-logout timer so it can be cancelled on re-login or unmount.
  const expiryTimer = useRef(null);
  const logoutCalled = useRef(false);

  // ── Core logout: clears timer, storage, and React state ─────────────────────
  // Idempotent — safe to call multiple times.
  const logout = () => {
    if (logoutCalled.current) return;
    logoutCalled.current = true;

    if (expiryTimer.current) {
      clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
    localStorage.removeItem('kj_token');
    localStorage.removeItem('kj_user');
    setToken(null);
    setUser(null);
  };

  // ── Schedule a silent logout exactly when the token expires ─────────────────
  // Any in-flight timer is cancelled first so re-login never stacks timers.
  const scheduleExpiry = (tok) => {
    if (expiryTimer.current) {
      clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
    const exp = jwtExp(tok);
    if (!exp) return;
    const delay = exp - Date.now();
    if (delay <= 0) return; // already expired — caller must handle
    expiryTimer.current = setTimeout(logout, delay);
  };

  // ── Check expiry when tab becomes visible or gains focus ────────────────────
  // Browser throttles setTimeout in background tabs. This catches expired
  // sessions when user returns to the tab.
  const checkExpiry = () => {
    if (logoutCalled.current) return; // already logged out
    const savedToken = localStorage.getItem('kj_token');
    if (!savedToken) return;
    const exp = jwtExp(savedToken);
    if (!exp || Date.now() >= exp) {
      logout();
    } else {
      // Session still valid — reschedule the timer in case it drifted.
      scheduleExpiry(savedToken);
    }
  };

  useEffect(() => {
    // ── Startup: validate stored token before trusting it ─────────────────────
    const savedToken = localStorage.getItem('kj_token');
    const savedUser  = localStorage.getItem('kj_user');

    if (savedToken && savedUser) {
      const exp = jwtExp(savedToken);
      if (exp && Date.now() >= exp) {
        // Token is already expired — clean up immediately so ProtectedRoute
        // redirects to /login rather than letting the user see stale data.
        logout();
      } else {
        try {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
          scheduleExpiry(savedToken);   // auto-logout when it expires
        } catch {
          logout(); // corrupted kj_user JSON
        }
      }
    }
    setLoading(false);

    // ── Listen for auth errors dispatched by the Axios interceptor ────────────
    // client.js fires 'kj-auth-expired' on every 401 response so that
    // the logout happens through React state — no hard page reload needed.
    // ProtectedRoute sees isAuthenticated → false and navigates to /login.
    const handleAuthExpired = () => logout();
    window.addEventListener('kj-auth-expired', handleAuthExpired);

    // ── Check expiry when tab becomes visible or window gains focus ───────────
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkExpiry();
    };
    const handleFocus = () => checkExpiry();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('kj-auth-expired', handleAuthExpired);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Login: store credentials and arm the expiry timer ────────────────────────
  const login = async (username, password) => {
    logoutCalled.current = false; // reset idempotency flag
    const response = await api.post('/auth/login', { username, password });
    const { token: newToken, user: userData } = response.data;

    localStorage.setItem('kj_token', newToken);
    localStorage.setItem('kj_user', JSON.stringify(userData));

    setToken(newToken);
    setUser(userData);
    scheduleExpiry(newToken);

    return userData;
  };

  const isAuthenticated = !!token && !!user;
  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAuthenticated, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
