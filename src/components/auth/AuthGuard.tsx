/**
 * AuthGuard — 認証ガードコンポーネント
 */
import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Spinner } from '@fluentui/react-components';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/services/authService';

interface Props {
  role: UserRole;
}

export default function AuthGuard({ role }: Props) {
  const { isAuthenticated, role: currentRole, isLoading, selectedCreator } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // designer は新しい統合ログインページへ
      const loginPath = role === 'viewer' ? '/viewer/login' : '/login';
      navigate(loginPath, { replace: true });
      return;
    }

    if (role === 'designer' && currentRole !== 'designer') {
      navigate('/viewer/demos', { replace: true });
      return;
    }

    // 認証済みだが作成者未選択 → 選択ページへ
    if (!selectedCreator) {
      navigate('/creator/select', { replace: true });
    }
  }, [isAuthenticated, currentRole, isLoading, role, navigate, location.pathname, selectedCreator]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Spinner size="large" label="Loading..." />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (role === 'designer' && currentRole !== 'designer') return null;
  if (!selectedCreator) return null;

  return <Outlet />;
}
