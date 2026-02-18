/**
 * 作成者マスターの永続化サービス
 */
import type { DemoCreator } from '@/types';
import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

export async function getAllCreators(): Promise<DemoCreator[]> {
  return apiGet<DemoCreator[]>('/creators');
}

export async function createCreator(name: string): Promise<DemoCreator> {
  return apiPost<DemoCreator>('/creators', { name });
}

export async function updateCreator(id: string, name: string): Promise<DemoCreator> {
  return apiPut<DemoCreator>(`/creators/${id}`, { name });
}

export async function deleteCreator(id: string): Promise<void> {
  await apiDelete(`/creators/${id}`);
}
