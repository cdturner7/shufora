import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDevAccess } from '../context/DevAccessContext';

function AdminRoute() {
  const { loading: authLoading } = useAuth();
  const { isDev, devLoading } = useDevAccess();

  if (authLoading || devLoading) return null;
  if (!isDev) return <Navigate to="/" replace />;
  return <Outlet />;
}

export default AdminRoute;
