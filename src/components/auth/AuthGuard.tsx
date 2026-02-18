/**
 * AuthGuard — 認証ガードコンポーネント
 *
 * 指定ロールが認証済みでなければログインページへリダイレクト。
 */
import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Spinner } from '@fluentui/react-components';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/services/authService';

interface Props {
  /** 許可するロール */
  role: UserRole;
}

export default function AuthGuard({ role }: Props) {
  const { isAuthenticated, role: currentRole, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // 未認証 → ルートURLは viewer ログインへ、それ以外は従来どおりロール別へ
      if (role === 'designer' && location.pathname === '/') {
        navigate('/viewer/login', { replace: true });
      } else {
        navigate(role === 'viewer' ? '/viewer/login' : '/admin/login', { replace: true });
      }
      return;
    }

    // viewer がデザイナー専用ページにアクセスしようとした場合
    if (role === 'designer' && currentRole !== 'designer') {
      navigate('/viewer/demos', { replace: true });
    }
  }, [isAuthenticated, currentRole, isLoading, role, navigate, location.pathname]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Spinner size="large" label="認証確認中..." />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (role === 'designer' && currentRole !== 'designer') return null;

  return <Outlet />;
}
