import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { Toaster } from 'react-hot-toast';

import { AuthProvider }    from './context/AuthContext';
import PrivateRoute        from './guards/PrivateRoute';
import RoleGuard           from './guards/RoleGuard';
import StudentLayout       from './layouts/StudentLayout';
import AdminLayout         from './layouts/AdminLayout';
import theme               from './utils/theme';
import { setSessionExpiredHandler } from './services/api';
import SessionExpiredModal from './components/SessionExpiredModal';

import Login               from './pages/Login';
import Signup              from './pages/Signup';
import ModulePlaceholder   from './pages/ModulePlaceholder';
import AdminAccounts       from './pages/admin/AdminAccounts';
import AccessControl       from './pages/admin/AccessControl';

// -------------------------------------------------------
// RoleRedirect
// Reads the logged-in user's roleId from localStorage and
// sends them to the correct home route.
// Used for the "/" catch-all when already authenticated.
// -------------------------------------------------------
function RoleRedirect() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) return <Navigate to="/login" replace />;
    if (user.roleId === 3) return <Navigate to="/dashboard" replace />;
    return <Navigate to="/admin/dashboard" replace />;
  } catch {
    return <Navigate to="/login" replace />;
  }
}

export default function App() {
  const [showSessionExpired, setShowSessionExpired] = useState(false);

  // Register handler for session expired modal
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setShowSessionExpired(true);
    });

    // Cleanup on unmount
    return () => setSessionExpiredHandler(null);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Toaster position="top-right" reverseOrder={false} />
      <AuthProvider>
        <BrowserRouter>
          {/* Session Expired Modal - renders at app root level */}
          <SessionExpiredModal
            open={showSessionExpired}
            onClose={() => setShowSessionExpired(false)}
          />
          <Routes>

            {/* ── Public routes ─────────────────────────────── */}
            <Route path="/login"  element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* ── Student routes (RoleId = 3) ───────────────── */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <RoleGuard allowed={[3]}>
                    <StudentLayout />
                  </RoleGuard>
                </PrivateRoute>
              }
            >
              {/* Index: redirect to /dashboard */}
              <Route index element={<ModulePlaceholder />} />
              <Route path="profile"       element={<ModulePlaceholder />} />
              <Route path="upcoming"      element={<ModulePlaceholder />} />
              <Route path="registered"    element={<ModulePlaceholder />} />
              <Route path="completed"     element={<ModulePlaceholder />} />
              <Route path="certificates"  element={<ModulePlaceholder />} />
              <Route path="recordings"    element={<ModulePlaceholder />} />
              <Route path="payments"      element={<ModulePlaceholder />} />
              <Route path="notifications" element={<ModulePlaceholder />} />
            </Route>

            {/* ── Admin / Super Admin routes (RoleId = 1 | 2) ── */}
            <Route
              path="/admin"
              element={
                <PrivateRoute>
                  <RoleGuard allowed={[1, 2]}>
                    <AdminLayout />
                  </RoleGuard>
                </PrivateRoute>
              }
            >
              {/* /admin → redirect to /admin/dashboard */}
              <Route index element={<Navigate to="/admin/dashboard" replace />} />

              {/* ── Webinar Management ── */}
              <Route path="dashboard"     element={<ModulePlaceholder />} />
              <Route path="webinars"      element={<ModulePlaceholder />} />
              <Route path="registrations" element={<ModulePlaceholder />} />
              <Route path="payments"      element={<ModulePlaceholder />} />
              <Route path="participants"  element={<ModulePlaceholder />} />
              <Route path="recordings"    element={<ModulePlaceholder />} />

              {/* ── Admin & Settings ── */}
              {/* AdminAccounts handles its own 403 state internally —
                  both Super Admin and Admin can reach the route,
                  but the page shows a friendly message for Admins */}
              <Route path="accounts" element={<AdminAccounts />} />
              {/* Access Control — Super Admin only */}
              <Route
                path="access"
                element={
                  <RoleGuard allowed={[1]}>
                    <AccessControl />
                  </RoleGuard>
                }
              />

              {/* ── Master Management ── */}
              <Route path="certifications"     element={<ModulePlaceholder />} />
              <Route path="categories"         element={<ModulePlaceholder />} />
              <Route path="webinar-types"      element={<ModulePlaceholder />} />
              <Route path="reminders"          element={<ModulePlaceholder />} />

              {/* ── Communication ── */}
              <Route path="notifications"      element={<ModulePlaceholder />} />
              <Route path="email-templates"    element={<ModulePlaceholder />} />
              <Route path="sms-templates"      element={<ModulePlaceholder />} />
              <Route path="whatsapp-templates" element={<ModulePlaceholder />} />
            </Route>

            {/* ── Root redirect ────────────────────────────── */}
            <Route path="/" element={<RoleRedirect />} />

            {/* ── 404 catch-all ────────────────────────────── */}
            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
