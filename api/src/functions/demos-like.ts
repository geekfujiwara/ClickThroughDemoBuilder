/**
 * POST   /api/demos/{demoId}/like  — いいね追加
 * DELETE /api/demos/{demoId}/like  — いいね取り消し
 * GET    /api/demos/{demoId}/like  — いいね状態取得
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as socialService from '../services/socialService.js';
import * as projectService from '../services/projectService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;

  const creatorId = auth.payload.creatorId;
  if (!creatorId) return { status: 400, jsonBody: { error: 'creatorId が必要です' } };

  const demoId = req.params['demoId'];
  if (!demoId) return { status: 400, jsonBody: { error: 'demoId が必要です' } };

  if (req.method === 'GET') {
    const liked = await socialService.hasLiked(demoId, creatorId);
    const count = await socialService.getLikeCountByDemo(demoId);
    return { status: 200, jsonBody: { liked, count } };
  }

  if (req.method === 'POST') {
    try {
      const like = await socialService.addLike(demoId, creatorId);
      // フィードに追加（デモタイトル取得）
      const project = await projectService.getProject(demoId).catch(() => null);
      if (project) {
        await socialService.addFeedEntry('like', creatorId, creatorId, {
          demoId,
          demoTitle: project.title,
        }).catch(() => {/* ignore */});
      }
      return { status: 201, jsonBody: like };
    } catch (e) {
      return { status: 400, jsonBody: { error: (e as Error).message } };
    }
  }

  if (req.method === 'DELETE') {
    await socialService.removeLike(demoId, creatorId);
    return { status: 204 };
  }

  return { status: 405 };
}

app.http('demos-like', {
  methods: ['GET', 'POST', 'DELETE'],
  authLevel: 'anonymous',
  route: 'demos/{demoId}/like',
  handler,
});
