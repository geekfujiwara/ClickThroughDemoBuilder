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

/** 新方式: email + password でログイン */
export async function loginWithEmail(
  email: string,
  password: string,
): Promise<{ role: UserRole; creatorId: string; name: string }> {
  const res = await apiPost<LoginResponse>('/auth/login', { email, password });
  return { role: res.role as UserRole, creatorId: res.creatorId!, name: res.name! };
}

/** 新規登録: メール確認リンクを送信 */
export async function register(input: {
  email: string;
  name: string;
  password: string;
  language: 'ja' | 'en';
  groupId?: string;
}): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/auth/register', input);
}

/** 確認トークンでアカウントを正式作成・ログイン */
export async function verifyEmail(
  token: string,
): Promise<{ role: UserRole; creatorId: string; name: string }> {
  const res = await apiPost<LoginResponse>('/auth/verify', { token });
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
