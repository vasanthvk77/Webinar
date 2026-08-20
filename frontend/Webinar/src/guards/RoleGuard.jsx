import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// -------------------------------------------------------
// RoleGuard
// Wraps a route that only specific roles can access.
//
// Usage:
//   <RoleGuard allowed={[1, 2]}>   ← Super Admin + Admin
//     <SomePage />
//   </RoleGuard>
//
//   <RoleGuard allowed={[1]}>      ← Super Admin only
//     <AccessControl />
//   </RoleGuard>
//
// If the user's role is not in the allowed list:
//   - Admins/SuperAdmins → redirect to /admin/dashboard
//   - Students           → redirect to /dashboard
// -------------------------------------------------------
export default function RoleGuard({ allowed, children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  if (!allowed.includes(user.roleId)) {
    // Redirect to their home, not a generic 403 page
    const home = user.roleId === 3 ? '/dashboard' : '/admin/dashboard';
    return <Navigate to={home} replace />;
  }

  return children;
}
