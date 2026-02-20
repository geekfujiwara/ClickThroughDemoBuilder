/**
 * ソーシャル機能サービス
 * いいね / お気に入り / コメント / フィード
 */
import crypto from 'node:crypto';
import type { DemoLike, DemoComment, DemoFavorite, FeedEntry, FeedEventType } from '../shared/types.js';
import * as blob from './blobService.js';

// ── Likes ────────────────────────────────────────────────────

async function loadLikes(): Promise<DemoLike[]> {
  const json = await blob.getLikesJson();
  if (!json) return [];
  try { return JSON.parse(json) as DemoLike[]; } catch { return []; }
}

async function saveLikes(likes: DemoLike[]): Promise<void> {
  await blob.putLikesJson(JSON.stringify(likes));
}

export async function getLikesByDemo(demoId: string): Promise<DemoLike[]> {
  const all = await loadLikes();
  return all.filter((l) => l.demoId === demoId);
}

export async function hasLiked(demoId: string, creatorId: string): Promise<boolean> {
  const all = await loadLikes();
  return all.some((l) => l.demoId === demoId && l.creatorId === creatorId);
}

export async function addLike(demoId: string, creatorId: string): Promise<DemoLike> {
  const all = await loadLikes();
  if (all.some((l) => l.demoId === demoId && l.creatorId === creatorId)) {
    throw new Error('すでにいいね済みです');
  }
  const like: DemoLike = { id: crypto.randomUUID(), demoId, creatorId, createdAt: new Date().toISOString() };
  all.push(like);
  await saveLikes(all);
  return like;
}

export async function removeLike(demoId: string, creatorId: string): Promise<void> {
  const all = await loadLikes();
  const next = all.filter((l) => !(l.demoId === demoId && l.creatorId === creatorId));
  await saveLikes(next);
}

export async function getLikeCountByDemo(demoId: string): Promise<number> {
  const all = await loadLikes();
  return all.filter((l) => l.demoId === demoId).length;
}

export async function getLikeCountsByCreator(): Promise<Map<string, number>> {
  const all = await loadLikes();
  const map = new Map<string, number>();
  // demoId -> count
  for (const l of all) {
    map.set(l.demoId, (map.get(l.demoId) ?? 0) + 1);
  }
  return map;
}

export async function getLikedDemoIdsByCreator(creatorId: string): Promise<string[]> {
  const all = await loadLikes();
  return all.filter((l) => l.creatorId === creatorId).map((l) => l.demoId);
}

// ── Favorites ────────────────────────────────────────────────

async function loadFavorites(): Promise<DemoFavorite[]> {
  const json = await blob.getFavoritesJson();
  if (!json) return [];
  try { return JSON.parse(json) as DemoFavorite[]; } catch { return []; }
}

async function saveFavorites(favorites: DemoFavorite[]): Promise<void> {
  await blob.putFavoritesJson(JSON.stringify(favorites));
}

export async function getFavoritesByCreator(creatorId: string): Promise<DemoFavorite[]> {
  const all = await loadFavorites();
  return all.filter((f) => f.creatorId === creatorId);
}

export async function hasFavorited(demoId: string, creatorId: string): Promise<boolean> {
  const all = await loadFavorites();
  return all.some((f) => f.demoId === demoId && f.creatorId === creatorId);
}

export async function addFavorite(demoId: string, creatorId: string): Promise<DemoFavorite> {
  const all = await loadFavorites();
  if (all.some((f) => f.demoId === demoId && f.creatorId === creatorId)) {
    throw new Error('すでにお気に入り済みです');
  }
  const fav: DemoFavorite = { id: crypto.randomUUID(), demoId, creatorId, createdAt: new Date().toISOString() };
  all.push(fav);
  await saveFavorites(all);
  return fav;
}

export async function removeFavorite(demoId: string, creatorId: string): Promise<void> {
  const all = await loadFavorites();
  const next = all.filter((f) => !(f.demoId === demoId && f.creatorId === creatorId));
  await saveFavorites(next);
}

// ── Comments ─────────────────────────────────────────────────

async function loadComments(): Promise<DemoComment[]> {
  const json = await blob.getCommentsJson();
  if (!json) return [];
  try { return JSON.parse(json) as DemoComment[]; } catch { return []; }
}

async function saveComments(comments: DemoComment[]): Promise<void> {
  await blob.putCommentsJson(JSON.stringify(comments));
}

export async function getCommentsByDemo(demoId: string): Promise<DemoComment[]> {
  const all = await loadComments();
  return all.filter((c) => c.demoId === demoId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addComment(demoId: string, creatorId: string, creatorName: string, body: string): Promise<DemoComment> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('コメント本文は必須です');
  const all = await loadComments();
  const comment: DemoComment = {
    id: crypto.randomUUID(),
    demoId,
    creatorId,
    creatorName,
    body: trimmed,
    createdAt: new Date().toISOString(),
  };
  all.push(comment);
  await saveComments(all);
  return comment;
}

export async function deleteComment(commentId: string, creatorId: string): Promise<void> {
  const all = await loadComments();
  const target = all.find((c) => c.id === commentId);
  if (!target) throw new Error('コメントが見つかりません');
  if (target.creatorId !== creatorId) throw new Error('自分のコメントのみ削除できます');
  await saveComments(all.filter((c) => c.id !== commentId));
}

export async function getCommentCountByDemo(demoId: string): Promise<number> {
  const all = await loadComments();
  return all.filter((c) => c.demoId === demoId).length;
}

// ── Feed ─────────────────────────────────────────────────────

const FEED_MAX = 200;

async function loadFeed(): Promise<FeedEntry[]> {
  const json = await blob.getFeedJson();
  if (!json) return [];
  try { return JSON.parse(json) as FeedEntry[]; } catch { return []; }
}

async function saveFeed(feed: FeedEntry[]): Promise<void> {
  await blob.putFeedJson(JSON.stringify(feed));
}

export async function getFeed(limit = 20, before?: string): Promise<FeedEntry[]> {
  const all = await loadFeed();
  const sorted = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filtered = before ? sorted.filter((e) => e.createdAt < before) : sorted;
  return filtered.slice(0, limit);
}

export async function appendFeedEntry(entry: Omit<FeedEntry, 'id' | 'createdAt'>): Promise<void> {
  const all = await loadFeed();
  const newEntry: FeedEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  } as FeedEntry;
  // 最新を先頭に
  all.unshift(newEntry);
  // 上限を超えたら末尾を削除
  if (all.length > FEED_MAX) all.splice(FEED_MAX);
  await saveFeed(all);
}

export async function addFeedEntry(
  eventType: FeedEventType,
  actorId: string,
  actorName: string,
  extras?: { demoId?: string; demoTitle?: string; commentBody?: string },
): Promise<void> {
  await appendFeedEntry({
    eventType,
    actorId,
    actorName,
    demoId: extras?.demoId,
    demoTitle: extras?.demoTitle,
    commentBody: extras?.commentBody,
  });
}
