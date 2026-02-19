/**
 * 認証サービス — ログイン/ログアウト/セッション確認
 */
import { apiGet, apiPost } from './apiClient';

export type UserRole = 'viewer' | 'designer';

interface LoginResponse {
  role: string;
  creatorId?: string;
  name?: string;
  message?: string;
}

interface MeResponse {
  authenticated: boolean;
  role?: UserRole;
  creatorId?: string | null;
}

/** 旧来方式: ロール + パスワードでログイン */
export async function login(role: UserRole, password: string): Promise<UserRole> {
  const res = await apiPost<LoginResponse>('/auth/login', { role, password });
  return res.role as UserRole;
}

/** Microsoft Entra ID トークンでログイン（SSO） */
export async function loginWithEntra(
  idToken: string,
): Promise<{ role: UserRole; creatorId: string; name: string }> {
  const res = await apiPost<LoginResponse>('/auth/entra', { idToken });
  return { role: res.role as UserRole, creatorId: res.creatorId!, name: res.name! };
}

/** ログアウト */
export async function logout(): Promise<void> {
  await apiPost('/auth/logout');
}

/** 現在のセッション情報を取得 */
export async function getMe(): Promise<{ authenticated: boolean; role?: UserRole; creatorId?: string | null }> {
  try {
    return await apiGet<MeResponse>('/auth/me');
  } catch {
    return { authenticated: false };
  }
}
