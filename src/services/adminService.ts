/**
 * 管理者サービス — ユーザー管理・申請管理 API
 */
import type { DemoCreator, TrustedAlias } from '@/types';
import type { UserRole } from '@/services/authService';
import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

/** 全ユーザー一覧取得 (admin 用) */
export async function getAdminUsers(): Promise<DemoCreator[]> {
  return apiGet<DemoCreator[]>('/management/users');
}

/** デザイナー権限申請一覧取得 (pending) */
export async function getPendingApplications(): Promise<DemoCreator[]> {
  return apiGet<DemoCreator[]>('/management/applications');
}

/** デザイナー権限申請を承認 */
export async function approveApplication(creatorId: string): Promise<{ message: string; creator: DemoCreator }> {
  return apiPost<{ message: string; creator: DemoCreator }>(`/management/applications/${creatorId}/approve`);
}

/** デザイナー権限申請を拒否 */
export async function rejectApplication(creatorId: string): Promise<{ message: string; creator: DemoCreator }> {
  return apiPost<{ message: string; creator: DemoCreator }>(`/management/applications/${creatorId}/reject`);
}

/** ユーザーのロール変更 */
export async function changeUserRole(creatorId: string, role: UserRole): Promise<DemoCreator> {
  return apiPut<DemoCreator>(`/management/users/${creatorId}/role`, { role });
}

/** ユーザーのブロック状態を変更 */
export async function setUserBlocked(creatorId: string, blocked: boolean): Promise<DemoCreator> {
  return apiPut<DemoCreator>(`/management/users/${creatorId}/block`, { blocked });
}

/** ユーザーの所属組織を変更 */
export async function changeUserGroup(creatorId: string, groupId: string | null): Promise<DemoCreator> {
  return apiPut<DemoCreator>(`/management/users/${creatorId}/group`, { groupId });
}

/** 信頼済みエイリアス一覧取得 (system_admin のみ) */
export async function getTrustedAliases(): Promise<TrustedAlias[]> {
  return apiGet<TrustedAlias[]>('/management/trusted-aliases');
}

/** 信頼済みエイリアスを追加または更新 (system_admin のみ) */
export async function upsertTrustedAlias(alias: string, role: 'designer' | 'user_admin'): Promise<TrustedAlias> {
  return apiPost<TrustedAlias>('/management/trusted-aliases', { alias, role });
}

/** 信頼済みエイリアスを削除 (system_admin のみ) */
export async function deleteTrustedAlias(alias: string): Promise<{ message: string }> {
  return apiDelete<{ message: string }>(`/management/trusted-aliases/${encodeURIComponent(alias)}`);
}
