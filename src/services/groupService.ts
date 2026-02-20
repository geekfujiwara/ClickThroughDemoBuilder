/**
 * グループマスターの永続化サービス
 */
import type { DemoGroup } from '@/types';
import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

export async function getAllGroups(): Promise<DemoGroup[]> {
  return apiGet<DemoGroup[]>('/groups');
}

export interface GroupInput {
  name: string;
  color?: string;
  textColor?: string;
  imageDataUrl?: string | null;
}

export async function createGroup(name: string, opts?: Omit<GroupInput, 'name'>): Promise<DemoGroup> {
  return apiPost<DemoGroup>('/groups', { name, ...opts });
}

export async function updateGroup(id: string, input: GroupInput): Promise<DemoGroup> {
  return apiPut<DemoGroup>(`/groups/${id}`, input);
}

export async function deleteGroup(id: string): Promise<void> {
  await apiDelete(`/groups/${id}`);
}
