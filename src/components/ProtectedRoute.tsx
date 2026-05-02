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

const getLoginByRole = (allowedRoles?: string[]) => {
  // If the route is for admin or juridico, redirect to admin login
  if (allowedRoles?.some(r => r === 'admin' || r === 'juridico')) {
    return '/login/admin';
  }
  return '/login';
};

const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const { professor, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!professor) {
    return <Navigate to={getLoginByRole(allowedRoles)} replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(professor.role)) {
    return <Navigate to={getHomeByRole(professor.role)} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;