/**
 * 管理者サービス — ユーザー管理・申請管理 API
 */
import type { DemoCreator } from '@/types';
import type { UserRole } from '@/services/authService';
import { apiGet, apiPost, apiPut } from './apiClient';

/** 全ユーザー一覧取得 (admin 用) */
export async function getAdminUsers(): Promise<DemoCreator[]> {
  return apiGet<DemoCreator[]>('/admin/users');
}

/** デザイナー権限申請一覧取得 (pending) */
export async function getPendingApplications(): Promise<DemoCreator[]> {
  return apiGet<DemoCreator[]>('/admin/applications');
}

/** デザイナー権限申請を承認 */
export async function approveApplication(creatorId: string): Promise<{ message: string; creator: DemoCreator }> {
  return apiPost<{ message: string; creator: DemoCreator }>(`/admin/applications/${creatorId}/approve`);
}

/** デザイナー権限申請を拒否 */
export async function rejectApplication(creatorId: string): Promise<{ message: string; creator: DemoCreator }> {
  return apiPost<{ message: string; creator: DemoCreator }>(`/admin/applications/${creatorId}/reject`);
}

/** ユーザーのロール変更 */
export async function changeUserRole(creatorId: string, role: UserRole): Promise<DemoCreator> {
  return apiPut<DemoCreator>(`/admin/users/${creatorId}/role`, { role });
}

/** ユーザーのブロック状態を変更 */
export async function setUserBlocked(creatorId: string, blocked: boolean): Promise<DemoCreator> {
  return apiPut<DemoCreator>(`/admin/users/${creatorId}/block`, { blocked });
}
