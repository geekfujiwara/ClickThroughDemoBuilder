/**
 * GET    /api/favorites            — お気に入り一覧（自分）
 * POST   /api/favorites            — お気に入り追加 { demoId }
 * DELETE /api/favorites/{demoId}   — お気に入り削除
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as socialService from '../services/socialService.js';

async function listHandler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;
  const creatorId = auth.payload.creatorId;
  if (!creatorId) return { status: 400, jsonBody: { error: 'creatorId が必要です' } };

  const favorites = await socialService.getFavoritesByCreator(creatorId);
  return { status: 200, jsonBody: favorites };
}

async function addHandler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;
  const creatorId = auth.payload.creatorId;
  if (!creatorId) return { status: 400, jsonBody: { error: 'creatorId が必要です' } };

  try {
    const body = (await req.json()) as { demoId?: string };
    const demoId = body.demoId?.trim();
    if (!demoId) return { status: 400, jsonBody: { error: 'demoId が必要です' } };
    const fav = await socialService.addFavorite(demoId, creatorId);
    return { status: 201, jsonBody: fav };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

async function deleteHandler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;
  const creatorId = auth.payload.creatorId;
  if (!creatorId) return { status: 400, jsonBody: { error: 'creatorId が必要です' } };

  const demoId = req.params['demoId'];
  if (!demoId) return { status: 400, jsonBody: { error: 'demoId が必要です' } };

  await socialService.removeFavorite(demoId, creatorId);
  return { status: 204 };
}

app.http('favorites-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'favorites',
  handler: listHandler,
});

app.http('favorites-add', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'favorites',
  handler: addHandler,
});

app.http('favorites-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'favorites/{demoId}',
  handler: deleteHandler,
});
