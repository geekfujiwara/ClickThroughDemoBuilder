/**
 * 認証サービス — ログイン/ログアウト/セッション確認
 */
import { apiGet, apiPost } from './apiClient';

export type UserRole = 'viewer' | 'designer';

interface LoginResponse {
  role: string;
  message: string;
}

interface MeResponse {
  authenticated: boolean;
  role?: UserRole;
}

/** パスワードでログイン */
export async function login(role: UserRole, password: string): Promise<UserRole> {
  const res = await apiPost<LoginResponse>('/auth/login', { role, password });
  return res.role as UserRole;
}

/** ログアウト */
export async function logout(): Promise<void> {
  await apiPost('/auth/logout');
}

/** 現在のセッション情報を取得 */
export async function getMe(): Promise<{ authenticated: boolean; role?: UserRole }> {
  try {
    return await apiGet<MeResponse>('/auth/me');
  } catch {
    return { authenticated: false };
  }
}
