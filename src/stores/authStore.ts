/**
 * authStore — 認証状態の Zustand ストア
 */
import { create } from 'zustand';
import type { UserRole } from '@/services/authService';
import type { DemoCreator } from '@/types';
import * as authService from '@/services/authService';
import * as creatorService from '@/services/creatorService';
import * as msalService from '@/services/msalService';
import { setCurrentLanguage } from '@/constants/i18n';

/** ログインソースを localStorage に永続化するキー */
const LOGIN_SOURCE_KEY = 'loginSource';

interface AuthState {
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  selectedCreator: DemoCreator | null;
  /** Microsoft Entra ID 経由でログインした場合 true */
  isEntraUser: boolean;
  /** ゲストモードでログインした場合 true */
  isGuest: boolean;
}

interface AuthActions {
  init: () => Promise<void>;
  /** Microsoft SSO でログイン */
  loginWithEntra: () => Promise<void>;
  /** ゲスト ID/パスワードでログイン */
  loginAsGuest: (loginId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectCreator: (creator: DemoCreator) => void;
  clearSelectedCreator: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  role: null,
  isAuthenticated: false,
  isLoading: true,
  selectedCreator: null,
  isEntraUser: false,
  isGuest: false,

  init: async () => {
    set({ isLoading: true });
    try {
      const me = await authService.getMe();
      const isEntraUser = localStorage.getItem(LOGIN_SOURCE_KEY) === 'entra';
      const isGuest = me.creatorId === 'guest';
      if (me.authenticated && isGuest) {
        // ゲストユーザー: creator プロファイル不要
        set({ isAuthenticated: true, role: me.role ?? null, selectedCreator: null, isLoading: false, isEntraUser: false, isGuest: true });
      } else if (me.authenticated && me.creatorId) {
        const creator = await creatorService.getCreator(me.creatorId);
        setCurrentLanguage(creator.language);
        set({ isAuthenticated: true, role: me.role ?? null, selectedCreator: creator, isLoading: false, isEntraUser, isGuest: false });
      } else if (me.authenticated) {
        // Entra ユーザーだが creatorId なし → 未認証扱い
        await authService.logout();
        localStorage.removeItem(LOGIN_SOURCE_KEY);
        set({ isAuthenticated: false, role: null, isLoading: false, isEntraUser: false, isGuest: false });
      } else {
        set({ isAuthenticated: false, role: null, isLoading: false, isEntraUser: false, isGuest: false });
      }
    } catch {
      set({ isAuthenticated: false, role: null, isLoading: false, isEntraUser: false, isGuest: false });
    }
  },

  loginWithEntra: async () => {
    // ログインフロー中に handleSessionExpiry が誤発動しないよう、
    // 先に loginSource をクリアする（前回セッションの残骸を除去）
    localStorage.removeItem(LOGIN_SOURCE_KEY);

    const result = await msalService.signInWithMicrosoft();
    const { role, creatorId } = await authService.loginWithEntra(result.idToken);
    const creator = await creatorService.getCreator(creatorId);

    // 全ての API コールが成功した後にのみ loginSource を設定する。
    // これにより getCreator が 401 を返しても handleSessionExpiry が
    // リダイレクトせず、エラーメッセージとして表示される。
    localStorage.setItem(LOGIN_SOURCE_KEY, 'entra');
    setCurrentLanguage(creator.language);
    set({ isAuthenticated: true, role, selectedCreator: creator, isEntraUser: true, isGuest: false });
  },

  loginAsGuest: async (loginId: string, password: string) => {
    const { role } = await authService.loginAsGuest(loginId, password);
    localStorage.setItem(LOGIN_SOURCE_KEY, 'guest');
    set({ isAuthenticated: true, role, selectedCreator: null, isEntraUser: false, isGuest: true });
  },

  logout: async () => {
    await authService.logout();
    localStorage.removeItem(LOGIN_SOURCE_KEY);
    setCurrentLanguage('en');
    set({ isAuthenticated: false, role: null, selectedCreator: null, isEntraUser: false, isGuest: false });
  },

  selectCreator: (creator) => {
    setCurrentLanguage(creator.language);
    set({ selectedCreator: creator });
  },

  clearSelectedCreator: () => {
    setCurrentLanguage('en');
    set({ selectedCreator: null });
  },
}));
