import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { Toaster } from 'react-hot-toast';

import { ThemeContextProvider, useAppTheme } from './context/ThemeContext';
import { AuthProvider }    from './context/AuthContext';
import PrivateRoute        from './guards/PrivateRoute';
import RoleGuard           from './guards/RoleGuard';
import StudentLayout       from './layouts/StudentLayout';
import AdminLayout         from './layouts/AdminLayout';
import { setSessionExpiredHandler } from './services/api';
import SessionExpiredModal from './components/SessionExpiredModal';

import Login               from './pages/Login';
import Signup              from './pages/Signup';
import ModulePlaceholder   from './pages/ModulePlaceholder';
import AdminAccounts       from './pages/admin/AdminAccounts';
import AccessControl       from './pages/admin/AccessControl';
import ActivityLogs        from './pages/admin/ActivityLogs';

// -------------------------------------------------------
// RoleRedirect
// Reads the logged-in user's roleId from localStorage and
// sends them to the correct home route.
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

// -------------------------------------------------------
// Inner app — consumes the live muiTheme from ThemeContext
// -------------------------------------------------------
function AppInner() {
  const { muiTheme } = useAppTheme();
  const [showSessionExpired, setShowSessionExpired] = useState(false);

  useEffect(() => {
    setSessionExpiredHandler(() => setShowSessionExpired(true));
    return () => setSessionExpiredHandler(null);
  }, []);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Toaster position="top-right" reverseOrder={false} />
      <AuthProvider>
        <BrowserRouter>
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
              <Route index element={<Navigate to="/admin/dashboard" replace />} />

              {/* ── Webinar Management ── */}
              <Route path="dashboard"     element={<ModulePlaceholder />} />
              <Route path="webinars"      element={<ModulePlaceholder />} />
              <Route path="registrations" element={<ModulePlaceholder />} />
              <Route path="payments"      element={<ModulePlaceholder />} />
              <Route path="participants"  element={<ModulePlaceholder />} />
              <Route path="recordings"    element={<ModulePlaceholder />} />

              {/* ── Admin & Settings ── */}
              <Route path="accounts" element={<AdminAccounts />} />
              <Route
                path="access"
                element={
                  <RoleGuard allowed={[1]}>
                    <AccessControl />
                  </RoleGuard>
                }
              />
              <Route
                path="activity-logs"
                element={
                  <RoleGuard allowed={[1]}>
                    <ActivityLogs />
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

// -------------------------------------------------------
// App — wraps everything in ThemeContextProvider so
// useAppTheme() is available everywhere in the tree.
// -------------------------------------------------------
export default function App() {
  return (
    <ThemeContextProvider>
      <AppInner />
    </ThemeContextProvider>
  );
}
