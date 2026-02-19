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
}

interface AuthActions {
  init: () => Promise<void>;
  login: (role: UserRole, password: string) => Promise<void>;
  /** Microsoft SSO でログイン */
  loginWithEntra: () => Promise<void>;
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

  init: async () => {
    set({ isLoading: true });
    try {
      const me = await authService.getMe();
      const isEntraUser = localStorage.getItem(LOGIN_SOURCE_KEY) === 'entra';
      if (me.authenticated && me.creatorId) {
        // email ログイン済み → JWT に creatorId が入っているので自動選択
        const creator = await creatorService.getCreator(me.creatorId);
        setCurrentLanguage(creator.language);
        set({ isAuthenticated: true, role: me.role ?? null, selectedCreator: creator, isLoading: false, isEntraUser });
      } else {
        set({ isAuthenticated: me.authenticated, role: me.role ?? null, isLoading: false, isEntraUser });
      }
    } catch {
      set({ isAuthenticated: false, role: null, isLoading: false, isEntraUser: false });
    }
  },

  login: async (role, password) => {
    const resultRole = await authService.login(role, password);
    localStorage.setItem(LOGIN_SOURCE_KEY, 'local');
    setCurrentLanguage('en');
    set({ isAuthenticated: true, role: resultRole, selectedCreator: null, isEntraUser: false });
  },

  loginWithEntra: async () => {
    const result = await msalService.signInWithMicrosoft();
    const { role, creatorId } = await authService.loginWithEntra(result.idToken);
    const creator = await creatorService.getCreator(creatorId);
    localStorage.setItem(LOGIN_SOURCE_KEY, 'entra');
    setCurrentLanguage(creator.language);
    set({ isAuthenticated: true, role, selectedCreator: creator, isEntraUser: true });
  },

  logout: async () => {
    await authService.logout();
    localStorage.removeItem(LOGIN_SOURCE_KEY);
    setCurrentLanguage('en');
    set({ isAuthenticated: false, role: null, selectedCreator: null, isEntraUser: false });
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
