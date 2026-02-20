/**
 * 作成者マスターの永続化サービス
 */
import type { DemoCreator } from '@/types';
import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

export interface CreatorMutationInput {
  name?: string;
  groupId?: string;
  language?: 'ja' | 'en';
  email?: string;
  color?: string;
}

export async function getAllCreators(): Promise<DemoCreator[]> {
  return apiGet<DemoCreator[]>('/creators');
}

export async function getCreator(id: string): Promise<DemoCreator> {
  return apiGet<DemoCreator>(`/creators/${id}`);
}

export async function createCreator(input: CreatorMutationInput): Promise<DemoCreator> {
  return apiPost<DemoCreator>('/creators', input);
}

export async function updateCreator(id: string, input: CreatorMutationInput): Promise<DemoCreator> {
  return apiPut<DemoCreator>(`/creators/${id}`, input);
}

export async function deleteCreator(id: string): Promise<void> {
  await apiDelete(`/creators/${id}`);
}
