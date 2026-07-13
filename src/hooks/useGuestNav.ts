/**
 * useGuestNav — ゲストモード時に ?guestMode=true を自動付与するナビゲーションヘルパー
 * また、URLの id / lang パラメータも自動で引き継ぐ
 */
import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { getCurrentLanguage, setCurrentLanguage, onLanguageChange, type AppLanguage } from '@/constants/i18n';

/** パスに guestMode=true / id / lang パラメータを付与して返す */
export function useGuestPath() {
  const isGuest = useAuthStore((s) => s.isGuest);
  const [searchParams] = useSearchParams();
  const idParam = searchParams.get('id');
  const langParam = searchParams.get('lang');

  return useCallback((path: string) => {
    let result = path;
    if (isGuest) {
      result = `${result}${result.includes('?') ? '&' : '?'}guestMode=true`;
    }
    if (idParam) {
      result = `${result}${result.includes('?') ? '&' : '?'}id=${idParam}`;
    }
    if (langParam === 'ja' || langParam === 'en') {
      result = `${result}${result.includes('?') ? '&' : '?'}lang=${langParam}`;
    }
    return result;
  }, [isGuest, idParam, langParam]);
}

/**
 * useLanguageUrlSync — 言語モードを URL の lang パラメータで永続化する
 * ゲストモードでは authStore.init() が言語を復元しないため、
 * 画面リフレッシュ時に URL の lang から言語を復元し、
 * 言語変更時には URL へ書き戻す。
 */
export function useLanguageUrlSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  const langParam = searchParams.get('lang');
  const isGuest = useAuthStore((s) => s.isGuest);

  // 初回マウント時: URL の lang を言語設定へ反映（リフレッシュ後の復元）
  useEffect(() => {
    if (langParam === 'ja' || langParam === 'en') {
      setCurrentLanguage(langParam as AppLanguage);
    }
    // マウント時のみ実行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ゲストモード時のみ、言語変更を URL の lang パラメータへ書き戻す
  useEffect(() => {
    if (!isGuest) return;

    const writeLang = (lang: AppLanguage) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('lang', lang);
          return next;
        },
        { replace: true },
      );
    };

    const unsubscribe = onLanguageChange(writeLang);
    // 現在の言語が URL に未反映なら同期しておく
    if (langParam !== getCurrentLanguage()) {
      writeLang(getCurrentLanguage());
    }
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, setSearchParams]);
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
