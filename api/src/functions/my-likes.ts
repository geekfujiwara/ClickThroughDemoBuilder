/**
 * GET /api/my-likes
 * 現在ログイン中のユーザーがいいねしたデモの ID 一覧を返す。
 * お気に入り一覧 (/api/favorites) と同様の単一呼び出しパターン。
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as socialService from '../services/socialService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;

  const creatorId = auth.payload.creatorId;
  if (!creatorId) return { status: 200, jsonBody: [] };

  const likedIds = await socialService.getLikedDemoIdsByCreator(creatorId);
  return { status: 200, jsonBody: likedIds };
}

app.http('my-likes', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'my-likes',
  handler,
});
