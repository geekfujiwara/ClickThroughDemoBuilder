/**
 * authStore — 認証状態の Zustand ストア
 */
import { create } from 'zustand';
import type { UserRole } from '@/services/authService';
import * as authService from '@/services/authService';

interface AuthState {
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  /** サーバーからセッション情報を取得して初期化 */
  init: () => Promise<void>;
  /** ログイン */
  login: (role: UserRole, password: string) => Promise<void>;
  /** ログアウト */
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  role: null,
  isAuthenticated: false,
  isLoading: true,

  init: async () => {
    set({ isLoading: true });
    try {
      const me = await authService.getMe();
      set({
        isAuthenticated: me.authenticated,
        role: me.role ?? null,
        isLoading: false,
      });
    } catch {
      set({ isAuthenticated: false, role: null, isLoading: false });
    }
  },

  login: async (role, password) => {
    const resultRole = await authService.login(role, password);
    set({ isAuthenticated: true, role: resultRole });
  },

  logout: async () => {
    await authService.logout();
    set({ isAuthenticated: false, role: null });
  },
}));
