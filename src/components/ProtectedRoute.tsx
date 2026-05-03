import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

const getHomeByRole = (role: string) => {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'juridico':
      return '/juridico';
    default:
      return '/dashboard';
  }
};

const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const { professor, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!professor) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(professor.role)) {
    return <Navigate to={getHomeByRole(professor.role)} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;