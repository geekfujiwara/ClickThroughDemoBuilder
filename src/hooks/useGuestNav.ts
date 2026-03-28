/**
 * useGuestNav — ゲストモード時に ?guestMode=true を自動付与するナビゲーションヘルパー
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

/** パスに guestMode=true を付与して返す */
export function useGuestPath() {
  const isGuest = useAuthStore((s) => s.isGuest);
  return useCallback((path: string) => (isGuest ? `${path}${path.includes('?') ? '&' : '?'}guestMode=true` : path), [isGuest]);
}

/** guestMode 付きで navigate するラッパー (数値を渡すと history.go 相当) */
export function useGuestNavigate() {
  const navigate = useNavigate();
  const guestPath = useGuestPath();
  return useCallback((to: string | number, opts?: { replace?: boolean }) => {
    if (typeof to === 'number') {
      navigate(to);
    } else {
      navigate(guestPath(to), opts);
    }
  }, [navigate, guestPath]);
}
