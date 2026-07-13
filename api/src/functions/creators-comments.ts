/**
 * GET    /api/creators/{creatorId}/comments               — プロフィールコメント一覧
 * POST   /api/creators/{creatorId}/comments               — プロフィールコメント追加
 * DELETE /api/creators/{creatorId}/comments/{commentId}   — コメント削除（投稿者 or プロフィール所有者）
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as socialService from '../services/socialService.js';
import * as creatorService from '../services/creatorService.js';

async function listHandler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;

  const creatorId = req.params['creatorId'];
  if (!creatorId) return { status: 400, jsonBody: { error: 'creatorId が必要です' } };

  const comments = await socialService.getProfileComments(creatorId);
  return { status: 200, jsonBody: comments };
}

async function addHandler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;
  const creatorId = auth.payload.creatorId;
  if (!creatorId) return { status: 400, jsonBody: { error: 'creatorId が必要です' } };

  const profileId = req.params['creatorId'];
  if (!profileId) return { status: 400, jsonBody: { error: 'creatorId が必要です' } };

  try {
    const body = (await req.json()) as { body?: string };
    const text = (body.body ?? '').trim();
    if (!text) return { status: 400, jsonBody: { error: 'コメント本文は必須です' } };
    if (text.length > 2000) return { status: 400, jsonBody: { error: 'コメントは2000文字以内です' } };

    const target = await creatorService.getCreatorById(profileId);
    if (!target) return { status: 404, jsonBody: { error: 'プロフィールが見つかりません' } };

    const creator = await creatorService.getCreatorById(creatorId);
    const creatorName = creator?.name ?? 'Unknown';
    const comment = await socialService.addProfileComment(profileId, creatorId, creatorName, text);
    return { status: 201, jsonBody: comment };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

async function deleteHandler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;
  const creatorId = auth.payload.creatorId;
  if (!creatorId) return { status: 400, jsonBody: { error: 'creatorId が必要です' } };

  const commentId = req.params['commentId'];
  if (!commentId) return { status: 400, jsonBody: { error: 'commentId が必要です' } };

  try {
    await socialService.deleteProfileComment(commentId, creatorId);
    return { status: 204 };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('creators-comments-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'creators/{creatorId}/comments',
  handler: listHandler,
});

app.http('creators-comments-add', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'creators/{creatorId}/comments',
  handler: addHandler,
});

app.http('creators-comments-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'creators/{creatorId}/comments/{commentId}',
  handler: deleteHandler,
});
