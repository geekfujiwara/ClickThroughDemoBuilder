/**
 * グループマスターの永続化サービス
 */
import type { DemoGroup } from '@/types';
import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

export async function getAllGroups(): Promise<DemoGroup[]> {
  return apiGet<DemoGroup[]>('/groups');
}

export async function createGroup(name: string, color?: string): Promise<DemoGroup> {
  return apiPost<DemoGroup>('/groups', { name, ...(color ? { color } : {}) });
}

export async function updateGroup(id: string, input: { name: string; color?: string }): Promise<DemoGroup> {
  return apiPut<DemoGroup>(`/groups/${id}`, input);
}

export async function deleteGroup(id: string): Promise<void> {
  await apiDelete(`/groups/${id}`);
}
