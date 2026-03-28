/**
 * AuthGuard — 認証ガードコンポーネント
 * role="viewer"      … viewer 以上（viewer / designer / user_admin / system_admin）を許可
 * role="designer"    … designer 以上（designer / user_admin / system_admin）を許可
 * role="user_admin"  … user_admin 以上（user_admin / system_admin）のみ許可
 * role="system_admin" … system_admin のみ許可
 */
import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Spinner } from '@fluentui/react-components';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/services/authService';

const ROLE_LEVEL: Record<UserRole, number> = {
  viewer: 0,
  designer: 1,
  user_admin: 2,
  system_admin: 3,
};

interface Props {
  role: UserRole;
}

export default function AuthGuard({ role }: Props) {
  const { isAuthenticated, role: currentRole, isLoading, selectedCreator, isGuest } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const guestParam = searchParams.get('guestMode') === 'true' || isGuest ? '?guestMode=true' : '';

  const hasAccess = currentRole ? ROLE_LEVEL[currentRole] >= ROLE_LEVEL[role] : false;

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate(`/login${guestParam}`, { replace: true });
      return;
    }

    if (!hasAccess) {
      navigate(`/${guestParam}`, { replace: true });
      return;
    }

    // ゲストユーザーは creator プロファイル不要
    if (!isGuest && !selectedCreator) {
      navigate('/creator/select', { replace: true });
    }
  }, [isAuthenticated, currentRole, isLoading, role, navigate, location.pathname, selectedCreator, hasAccess, isGuest, guestParam]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Spinner size="large" label="Loading..." />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (!hasAccess) return null;
  if (!isGuest && !selectedCreator) return null;

  return <Outlet />;
}
