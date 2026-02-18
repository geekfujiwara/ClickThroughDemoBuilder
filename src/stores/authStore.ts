/**
 * authStore — 認証状態の Zustand ストア
 */
import { create } from 'zustand';
import type { UserRole } from '@/services/authService';
import type { DemoCreator } from '@/types';
import * as authService from '@/services/authService';
import * as creatorService from '@/services/creatorService';
import { setCurrentLanguage } from '@/constants/i18n';

interface AuthState {
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  selectedCreator: DemoCreator | null;
}

interface AuthActions {
  init: () => Promise<void>;
  login: (role: UserRole, password: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  /** メール確認完了後に認証状態を反映する */
  setVerified: (role: UserRole, creator: DemoCreator) => void;
  logout: () => Promise<void>;
  selectCreator: (creator: DemoCreator) => void;
  clearSelectedCreator: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  role: null,
  isAuthenticated: false,
  isLoading: true,
  selectedCreator: null,

  init: async () => {
    set({ isLoading: true });
    try {
      const me = await authService.getMe();
      if (me.authenticated && me.creatorId) {
        // email ログイン済み → JWT に creatorId が入っているので自動選択
        const creator = await creatorService.getCreator(me.creatorId);
        setCurrentLanguage(creator.language);
        set({ isAuthenticated: true, role: me.role ?? null, selectedCreator: creator, isLoading: false });
      } else {
        set({ isAuthenticated: me.authenticated, role: me.role ?? null, isLoading: false });
      }
    } catch {
      set({ isAuthenticated: false, role: null, isLoading: false });
    }
  },

  login: async (role, password) => {
    const resultRole = await authService.login(role, password);
    setCurrentLanguage('en');
    set({ isAuthenticated: true, role: resultRole, selectedCreator: null });
  },

  loginWithEmail: async (email, password) => {
    const { role, creatorId } = await authService.loginWithEmail(email, password);
    const creator = await creatorService.getCreator(creatorId);
    setCurrentLanguage(creator.language);
    set({ isAuthenticated: true, role, selectedCreator: creator });
  },

  setVerified: (role, creator) => {
    setCurrentLanguage(creator.language);
    set({ isAuthenticated: true, role, selectedCreator: creator });
  },

  logout: async () => {
    await authService.logout();
    setCurrentLanguage('en');
    set({ isAuthenticated: false, role: null, selectedCreator: null });
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
