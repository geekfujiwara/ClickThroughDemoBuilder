/**
 * グループマスターの永続化サービス
 */
import type { DemoGroup } from '@/types';
import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

export async function getAllGroups(): Promise<DemoGroup[]> {
  return apiGet<DemoGroup[]>('/groups');
}

export async function createGroup(name: string): Promise<DemoGroup> {
  return apiPost<DemoGroup>('/groups', { name });
}

export async function updateGroup(id: string, name: string): Promise<DemoGroup> {
  return apiPut<DemoGroup>(`/groups/${id}`, { name });
}

export async function deleteGroup(id: string): Promise<void> {
  await apiDelete(`/groups/${id}`);
}
