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
      url.includes('/api/auth/google') ||
      url.includes('/api/auth/send-otp') ||
      url.includes('/api/auth/verify-otp');

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
    api.post('/api/auth/google', { token: googleToken }),

  // POST /api/auth/send-otp
  // Sends { email, purpose }
  // Returns { success, message, remainingDailyOtps }
  sendOtp: (email, purpose = 1) =>
    api.post('/api/auth/send-otp', { email, purpose }),

  // POST /api/auth/verify-otp
  // Sends { email, otp, purpose }
  // Returns { success, message }
  verifyOtp: (email, otp, purpose = 1) =>
    api.post('/api/auth/verify-otp', { email, otp, purpose })
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

// -------------------------------------------------------
// Activity Logs — Super Admin only
// -------------------------------------------------------
export const activityLogService = {
  // GET /api/activity-logs — fetches paginated, filtered audit logs
  getLogs: (params) =>
    api.get('/api/activity-logs', { params }),

  // GET /api/activity-logs/lookups — fetches dynamic module/action filters
  getLookups: () =>
    api.get('/api/activity-logs/lookups'),
};

// -------------------------------------------------------
// Categories — Super Admin create/delete, all admins read
// -------------------------------------------------------
export const categoryService = {
  // GET /api/categories
  getAll: () =>
    api.get('/api/categories'),

  // POST /api/categories  body: { categoryName }
  create: (categoryName) =>
    api.post('/api/categories', { categoryName }),

  // PUT /api/categories/:id  body: { categoryName }
  update: (id, categoryName) =>
    api.put(`/api/categories/${id}`, { categoryName }),

  // DELETE /api/categories/:id
  delete: (id) =>
    api.delete(`/api/categories/${id}`),
};

// -------------------------------------------------------
// Webinars — Super Admin create/update/delete, all admins read
// -------------------------------------------------------
export const webinarService = {
  // GET /api/webinars
  getAll: () =>
    api.get('/api/webinars'),

  // Condition 1: All/Upcoming webinars
  getUpcoming: () =>
    api.get('/api/webinars/upcoming'),

  // Condition 2: Registered webinars for the authenticated student
  getRegistered: () =>
    api.get('/api/webinars/registered'),

  // Condition 1 & 2 & 3: Completed webinars & certificate eligibility
  getCompleted: () =>
    api.get('/api/webinars/completed'),

  // GET /api/webinars/participants — Admin view participants from wms.WebinarCompleted
  getParticipants: (webinarId) =>
    api.get('/api/webinars/participants', { params: webinarId ? { webinarId } : {} }),

  // GET /api/webinars/payments — Admin view webinar payments and revenue (Calls: wms.GetPayments)
  getPayments: () =>
    api.get('/api/webinars/payments'),

  // GET /api/webinars/my-payments — Student view enrolled webinars and payment details
  getMyPayments: () =>
    api.get('/api/webinars/my-payments'),

  // GET /api/webinars/country-codes — Distinct user country codes for pricing
  getCountryCodes: () =>
    api.get('/api/webinars/country-codes'),

  // GET /api/webinars/:id/prices — Country pricing configured for a webinar
  getWebinarPrices: (webinarId) =>
    api.get(`/api/webinars/${webinarId}/prices`),

  // Preview personalized certificate PDF inline for View modal
  previewStudentCertificate: (webinarId) =>
    api.get(`/api/webinars/${webinarId}/certificate/preview`, { responseType: 'blob' }),

  // Download personalized certificate PDF generated by QuestPDF
  downloadStudentCertificate: (webinarId) =>
    api.get(`/api/webinars/${webinarId}/certificate/download`, { responseType: 'blob' }),

  // POST /api/webinars
  create: (data) =>
    api.post('/api/webinars', data),

  // POST /api/webinars/upload-image
  uploadImage: (file, existingUrl) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/webinars/upload-image', formData, {
      params: existingUrl ? { existingUrl } : {},
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // PUT /api/webinars/:id
  update: (id, data) =>
    api.put(`/api/webinars/${id}`, data),

  // DELETE /api/webinars/:id
  delete: (id) =>
    api.delete(`/api/webinars/${id}`),

  // POST /api/webinars/:id/bulk-invite
  bulkInvite: (id) =>
    api.post(`/api/webinars/${id}/bulk-invite`),

  // POST /api/webinars/hold-seat — Atomically holds a seat for 5 mins (BookMyShow pattern)
  holdSeat: (trackingId, userId) =>
    api.post('/api/webinars/hold-seat', { trackingId, userId }),

  // POST /api/webinars/register-tracking
  registerTracking: (trackingId, userId, holdToken) =>
    api.post('/api/webinars/register-tracking', { trackingId, userId, holdToken }),

  // GET /api/webinars/public/:shareId
  getPublic: (shareId) =>
    api.get(`/api/webinars/public/${shareId}`),

  // GET /api/webinars/:id/email-status
  getEmailStatus: (id) =>
    api.get(`/api/webinars/${id}/email-status`),

  // POST /api/webinars/check-email
  checkEmail: (email) =>
    api.post('/api/webinars/check-email', { email }),
};

// -------------------------------------------------------
// Certificate Templates — Admin management & QuestPDF download
// -------------------------------------------------------
export const certificateService = {
  // GET /api/certificates/templates
  getTemplates: () =>
    api.get('/api/certificates/templates'),

  // GET /api/certificates/templates/:id/preview — authenticated image blob
  getPreview: (templateId) =>
    api.get(`/api/certificates/templates/${templateId}/preview`, { responseType: 'blob' }),

  // GET /api/certificates/templates/:id/download — blob PDF
  downloadPdf: (templateId, params = {}) =>
    api.get(`/api/certificates/templates/${templateId}/download`, {
      params,
      responseType: 'blob'
    }),

  // POST /api/certificates/templates/:id/generate — custom fields blob PDF
  generatePdf: (templateId, data) =>
    api.post(`/api/certificates/templates/${templateId}/generate`, data, {
      responseType: 'blob'
    }),
};

// -------------------------------------------------------
// Visual Certificate Template Builder — Admin management
// -------------------------------------------------------
export const certificateTemplateService = {
  // GET /api/certificate-templates
  getAll: () =>
    api.get('/api/certificate-templates'),

  // GET /api/certificate-templates/:id
  getById: (id) =>
    api.get(`/api/certificate-templates/${id}`),

  // POST /api/certificate-templates
  create: (data) =>
    api.post('/api/certificate-templates', data),

  // PUT /api/certificate-templates/:id
  update: (id, data) =>
    api.put(`/api/certificate-templates/${id}`, data),

  // DELETE /api/certificate-templates/:id
  delete: (id) =>
    api.delete(`/api/certificate-templates/${id}`),

  // POST /api/certificate-templates/upload-image
  uploadImage: (formData) =>
    api.post('/api/certificate-templates/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  // DELETE /api/certificate-templates/images?fileName=:fileName
  deleteImage: (fileName) =>
    api.delete(`/api/certificate-templates/images?fileName=${encodeURIComponent(fileName)}`),
};

// -------------------------------------------------------
// Meetings — Schedule meeting settings in SQL table
// -------------------------------------------------------
export const meetingService = {
  // POST /api/meetings/schedule
  schedule: (data) =>
    api.post('/api/meetings/schedule', data),

  // GET /api/meetings/webinar/:webinarId
  getByWebinarId: (webinarId) =>
    api.get(`/api/meetings/webinar/${webinarId}`),

  // POST /api/meetings/regenerate-moderator-link/:webinarId
  regenerateModeratorLink: (webinarId) =>
    api.post(`/api/meetings/regenerate-moderator-link/${webinarId}`),
};

// -------------------------------------------------------
// Dashboard — Analytics (Admin & Student)
// -------------------------------------------------------
export const dashboardService = {
  // GET /api/admin/dashboard
  getStats: () =>
    api.get('/api/admin/dashboard'),

  // GET /api/student/dashboard
  getStudentStats: () =>
    api.get('/api/student/dashboard'),
};

// -------------------------------------------------------
// Student Profile — Personal details & avatar upload
// -------------------------------------------------------
export const studentProfileService = {
  // GET /api/student/profile
  getProfile: () =>
    api.get('/api/student/profile'),

  // PUT /api/student/profile
  updateProfile: (data) =>
    api.put('/api/student/profile', data),

  // POST /api/student/profile/upload-photo
  uploadPhoto: (formData) =>
    api.post('/api/student/profile/upload-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
};

// -------------------------------------------------------
// Google Calendar — Student Webinar Event Integration
// -------------------------------------------------------
export const calendarService = {
  // POST /api/calendar/add-event
  addEvent: (webinarId, timeZone) =>
    api.post('/api/calendar/add-event', { webinarId, timeZone }),

  // GET /api/calendar/auth-url
  getAuthUrl: (webinarId) =>
    api.get('/api/calendar/auth-url', { params: { webinarId } }),
};

// -------------------------------------------------------
// Recordings & Transcripts
// -------------------------------------------------------
export const recordingService = {
  // GET /api/recordings
  getAll: () =>
    api.get('/api/recordings'),

  // GET /api/recordings/:webinarId/transcript
  getTranscript: (webinarId) =>
    api.get(`/api/recordings/${webinarId}/transcript`),
};

export default api;

