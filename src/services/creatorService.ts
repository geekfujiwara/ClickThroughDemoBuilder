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
  bio?: string;
  xUrl?: string;
  linkedInUrl?: string;
  youTubeUrl?: string;
}

/** 公開プロフィールのデモサマリ */
export interface ProfileDemoSummary {
  id: string;
  demoNumber: number;
  title: string;
  description: string;
  groupId?: string;
  creatorId?: string;
  thumbnailDataUrl: string;
  clickPointCount: number;
  duration: number;
  updatedAt: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  playCount: number;
  totalPlayDuration: number;
}

export interface ProfileStats {
  demoCount: number;
  totalLikes: number;
  totalComments: number;
  totalPlays: number;
  totalPlayDuration: number;
}

export interface CreatorProfile {
  creator: DemoCreator;
  stats: ProfileStats;
  demos: ProfileDemoSummary[];
}

export async function getAllCreators(): Promise<DemoCreator[]> {
  return apiGet<DemoCreator[]>('/creators');
}

export async function getCreator(id: string): Promise<DemoCreator> {
  return apiGet<DemoCreator>(`/creators/${id}`);
}

/** 公開プロフィール（クリエイター情報 + 公開デモ + 統計サマリ）を取得 */
export async function getCreatorProfile(id: string): Promise<CreatorProfile> {
  return apiGet<CreatorProfile>(`/creators/${id}/profile`);
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
