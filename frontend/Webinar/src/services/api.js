import axios from 'axios';
import toast from 'react-hot-toast';

// Base URL comes from .env file — never hardcoded
// In .env: VITE_API_BASE_URL=https://localhost:7001
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Automatically attach the JWT token to every request if one is stored
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Session expired handler (set by App.jsx) ─────────────
// This allows the axios interceptor (outside React) to trigger
// the SessionExpiredModal (inside React) via a callback.
let sessionExpiredHandler = null;

export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = handler;
}

// ── Auto-logout on expired / invalid token (401) ─────────
// When the JWT expires, the API returns 401. Instead of
// leaving the user stuck on a broken page, we clear the
// session and trigger the modal via the registered handler.
//
// Auth endpoints are excluded so a failed login/register
// (wrong credentials → 401) still shows the error message
// on the form instead of triggering a redirect.
let isRedirectingToLogin = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url    = error.config?.url || '';

    const isAuthEndpoint =
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/register') ||
      url.includes('/api/auth/google');

    if (status === 401 && !isAuthEndpoint && !isRedirectingToLogin) {
      isRedirectingToLogin = true;

      // Clear session — same keys as AuthContext.logout()
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('firstName');
      localStorage.removeItem('allowedTabs');

      // Trigger the modal if handler is registered, otherwise fallback to direct redirect
      if (!window.location.pathname.startsWith('/login')) {
        if (sessionExpiredHandler) {
          sessionExpiredHandler();
        } else {
          toast.error('Session expired. Please login again.');
          window.location.href = '/login';
        }
      } else {
        isRedirectingToLogin = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth service with all authentication endpoints
export const authService = {
  // POST /api/auth/register
  // Sends { firstName, lastName, email, password, countryCode, mobileNumber }
  // Returns { success, message, user, token }
  register: (firstName, lastName, email, password, countryCode, mobileNumber) =>
    api.post('/api/auth/register', {
      firstName,
      lastName,
      email,
      password,
      countryCode,
      mobileNumber
    }),

  // POST /api/auth/login
  // Sends { email, password }
  // Returns { success, message, user, token }
  login: (email, password) =>
    api.post('/api/auth/login', { email, password }),

  // POST /api/auth/google
  // Sends { token } - Google ID token from frontend
  // Returns { success, message, user, token }
  googleLogin: (googleToken) =>
    api.post('/api/auth/google', { token: googleToken })
};

// -------------------------------------------------------
// Tab access — returns the caller's allowed routes
// Called once after login for Admin users (RoleId=2)
// -------------------------------------------------------
export const tabService = {
  // GET /api/tabs
  // Returns { success, routes: ["/admin/webinars", ...] }
  // JWT must be set in localStorage before calling this
  getMyTabs: () => api.get('/api/tabs'),
};

// -------------------------------------------------------
// Admin user management — Super Admin only
// All calls require Bearer token with RoleId=1
// -------------------------------------------------------
export const adminService = {
  // GET /api/admin/accounts — list all admins
  getAll: () =>
    api.get('/api/admin/accounts'),

  // POST /api/admin/accounts — create admin
  create: (data) =>
    api.post('/api/admin/accounts', data),

  // PUT /api/admin/accounts/:id — update profile + optional role promotion
  update: (id, data) =>
    api.put(`/api/admin/accounts/${id}`, data),

  // PUT /api/admin/accounts/:id/status — revoke / grant access
  setStatus: (id, isActive) =>
    api.put(`/api/admin/accounts/${id}/status`, { isActive }),

  // DELETE /api/admin/accounts/:id — hard delete
  delete: (id) =>
    api.delete(`/api/admin/accounts/${id}`),
};

// -------------------------------------------------------
// Access Control — tab permission management
// Super Admin only
// -------------------------------------------------------
export const accessService = {
  // GET /api/access/admins — admin list for left panel
  getAdmins: () =>
    api.get('/api/access/admins'),

  // GET /api/access/admins/:userId/tabs — full tab matrix
  getTabMatrix: (userId) =>
    api.get(`/api/access/admins/${userId}/tabs`),

  // PUT /api/access/admins/:userId/tabs/:tabId — toggle a tab
  // body: { isAllowed: bool }
  setTabOverride: (userId, tabId, isAllowed) =>
    api.put(`/api/access/admins/${userId}/tabs/${tabId}`, { isAllowed }),

  // DELETE /api/access/admins/:userId/overrides — reset to role defaults
  resetOverrides: (userId) =>
    api.delete(`/api/access/admins/${userId}/overrides`),
};

export default api;

