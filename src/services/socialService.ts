/**
 * ソーシャル機能 API クライアント
 */
import { apiGet, apiPost, apiDelete } from './apiClient';
import type { DemoLike, DemoComment, DemoFavorite, FeedEntry } from '@/types';

// ── 共通 ─────────────────────────────────────────────────────

interface LikeStatus {
  liked: boolean;
  count: number;
}

// ── いいね ───────────────────────────────────────────────────

export async function getLikeStatus(demoId: string): Promise<LikeStatus> {
  return apiGet<LikeStatus>(`/demos/${demoId}/like`);
}

export async function addLike(demoId: string): Promise<DemoLike> {
  return apiPost<DemoLike>(`/demos/${demoId}/like`);
}

export async function removeLike(demoId: string): Promise<void> {
  await apiDelete(`/demos/${demoId}/like`);
}

// ── お気に入り ────────────────────────────────────────────────

export async function getFavorites(): Promise<DemoFavorite[]> {
  return apiGet<DemoFavorite[]>('/favorites');
}

export async function addFavorite(demoId: string): Promise<DemoFavorite> {
  return apiPost<DemoFavorite>('/favorites', { demoId });
}

export async function removeFavorite(demoId: string): Promise<void> {
  await apiDelete(`/favorites/${demoId}`);
}

// ── コメント ─────────────────────────────────────────────────

export async function getComments(demoId: string): Promise<DemoComment[]> {
  return apiGet<DemoComment[]>(`/demos/${demoId}/comments`);
}

export async function addComment(demoId: string, body: string): Promise<DemoComment> {
  return apiPost<DemoComment>(`/demos/${demoId}/comments`, { body });
}

export async function deleteComment(demoId: string, commentId: string): Promise<void> {
  await apiDelete(`/demos/${demoId}/comments/${commentId}`);
}

// ── フィード ─────────────────────────────────────────────────

export async function getFeed(limit = 20, before?: string): Promise<FeedEntry[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set('before', before);
  return apiGet<FeedEntry[]>(`/feed?${params.toString()}`);
}

// ── デザイナー申請 ────────────────────────────────────────────

export async function applyDesigner(reason: string): Promise<{ message: string }> {
  return apiPost<{ message: string }>('/auth/apply-designer', { reason });
}

// ── ホームランキング ──────────────────────────────────────────

export interface DemoSummary {
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
  totalPlayDuration?: number;
}

export interface CreatorRankingEntry {
  id: string;
  name: string;
  totalLikes?: number;
  demoCount?: number;
}

export interface HomeRankings {
  popularByLikes: DemoSummary[];
  recentDemos: DemoSummary[];
  popularByPlay: DemoSummary[];
  recentComments: FeedEntry[];
  popularByDuration: DemoSummary[];
  topCreatorsByLikes: CreatorRankingEntry[];
  topCreatorsByDemos: CreatorRankingEntry[];
}

export async function getHomeRankings(): Promise<HomeRankings> {
  return apiGet<HomeRankings>('/home/rankings');
}
