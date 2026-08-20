import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// -------------------------------------------------------
// PrivateRoute
// Redirects to /login if not authenticated.
// Preserves the attempted URL so we can redirect back
// after login if needed.
// -------------------------------------------------------
export default function PrivateRoute({ children }) {
  const { isLoggedIn } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
