/**
 * GET    /api/demos/{demoId}/comments               — コメント一覧
 * POST   /api/demos/{demoId}/comments               — コメント追加
 * DELETE /api/demos/{demoId}/comments/{commentId}   — コメント削除（自分のみ）
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as socialService from '../services/socialService.js';
import * as creatorService from '../services/creatorService.js';
import * as projectService from '../services/projectService.js';

async function listHandler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;

  const demoId = req.params['demoId'];
  if (!demoId) return { status: 400, jsonBody: { error: 'demoId が必要です' } };

  const comments = await socialService.getCommentsByDemo(demoId);
  return { status: 200, jsonBody: comments };
}

async function addHandler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;
  const creatorId = auth.payload.creatorId;
  if (!creatorId) return { status: 400, jsonBody: { error: 'creatorId が必要です' } };

  const demoId = req.params['demoId'];
  if (!demoId) return { status: 400, jsonBody: { error: 'demoId が必要です' } };

  try {
    const body = (await req.json()) as { body?: string };
    const text = (body.body ?? '').trim();
    if (!text) return { status: 400, jsonBody: { error: 'コメント本文は必須です' } };

    const creator = await creatorService.getCreatorById(creatorId);
    const creatorName = creator?.name ?? 'Unknown';
    const comment = await socialService.addComment(demoId, creatorId, creatorName, text);

    // フィード追加
    const project = await projectService.getProject(demoId).catch(() => null);
    await socialService.addFeedEntry('comment', creatorId, creatorName, {
      demoId,
      demoTitle: project?.title,
      commentBody: text.slice(0, 100),
    }).catch((e) => context.warn('Feed error:', (e as Error).message));

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
    await socialService.deleteComment(commentId, creatorId);
    return { status: 204 };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('demos-comments-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'demos/{demoId}/comments',
  handler: listHandler,
});

app.http('demos-comments-add', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'demos/{demoId}/comments',
  handler: addHandler,
});

app.http('demos-comments-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'demos/{demoId}/comments/{commentId}',
  handler: deleteHandler,
});
