/**
 * AuthGuard — 認証ガードコンポーネント
 * role="viewer"   … viewer 以上（viewer / designer）を許可
 * role="designer" … designer のみ許可
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
      // 未認証 → ログインページへ
      navigate('/login', { replace: true });
      return;
    }

    // designer のみ許可するルートで viewer がアクセスしようとした場合
    if (role === 'designer' && currentRole !== 'designer') {
      navigate('/', { replace: true });
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
