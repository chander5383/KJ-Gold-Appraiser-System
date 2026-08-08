import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor — attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('kj_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Prevents duplicate "session expired" toasts when several concurrent
// requests all receive a 401/403 at the same time.
let sessionExpiredShown = false;

// Response interceptor — handle 401 (expired/missing) and 403 (invalid token).
// Auth endpoints (/auth/*) are excluded so a wrong-password 401 is not
// misread as a session expiry.
api.interceptors.response.use(
  (response) => {
    // Any successful response means the user is active again — reset the
    // dedup flag so the next genuine expiry shows a fresh toast.
    sessionExpiredShown = false;
    return response;
  },
  (error) => {
    const status  = error.response?.status;
    const url     = error.config?.url ?? '';
    const isAuthEndpoint = url.includes('/auth/');

    if ((status === 401 || status === 403) && !isAuthEndpoint) {
      // Clear stored credentials immediately so any parallel requests that
      // resolve after this one don't find stale auth data.
      localStorage.removeItem('kj_token');
      localStorage.removeItem('kj_user');

      if (!sessionExpiredShown) {
        sessionExpiredShown = true;
        toast.error('Session expired. Please login again.', { id: 'session-expired' });
      }

      // Dispatch to the AuthContext listener (see AuthContext.jsx).
      // AuthContext calls logout() → isAuthenticated becomes false →
      // ProtectedRoute renders <Navigate to="/login" /> — no hard reload.
      window.dispatchEvent(new Event('kj-auth-expired'));
    }

    return Promise.reject(error);
  }
);

export default api;
