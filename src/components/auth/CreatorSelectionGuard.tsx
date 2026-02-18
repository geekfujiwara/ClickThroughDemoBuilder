import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export default function CreatorSelectionGuard() {
  const selectedCreator = useAuthStore((s) => s.selectedCreator);
  const location = useLocation();

  if (location.pathname === '/creator/select') {
    return <Outlet />;
  }

  if (!selectedCreator) {
    return <Navigate to="/creator/select" replace />;
  }

  return <Outlet />;
}
