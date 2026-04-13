/**
 * useGuestNav — ゲストモード時に ?guestMode=true を自動付与するナビゲーションヘルパー
 * また、URLの id パラメータも自動で引き継ぐ
 */
import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

/** パスに guestMode=true および id パラメータを付与して返す */
export function useGuestPath() {
  const isGuest = useAuthStore((s) => s.isGuest);
  const [searchParams] = useSearchParams();
  const idParam = searchParams.get('id');

  return useCallback((path: string) => {
    let result = path;
    if (isGuest) {
      result = `${result}${result.includes('?') ? '&' : '?'}guestMode=true`;
    }
    if (idParam) {
      result = `${result}${result.includes('?') ? '&' : '?'}id=${idParam}`;
    }
    return result;
  }, [isGuest, idParam]);
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
