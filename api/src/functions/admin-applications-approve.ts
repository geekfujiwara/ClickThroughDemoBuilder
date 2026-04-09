/**
 * POST /api/admin/applications/{creatorId}/approve
 * デザイナー権限申請を承認（user_admin / system_admin 用）
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as creatorService from '../services/creatorService.js';
import * as socialService from '../services/socialService.js';

async function handler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'user_admin', 'system_admin');
  if ('status' in auth) return auth;

  const creatorId = req.params['creatorId'];
  if (!creatorId) return { status: 400, jsonBody: { error: 'creatorId は必須です' } };

  try {
    const creator = await creatorService.verifyDesigner(creatorId);

    // フィードに追加
    await socialService.addFeedEntry('new_designer', creator.id, creator.name).catch(
      (e) => context.warn('Feed entry error:', (e as Error).message),
    );

    return { status: 200, jsonBody: { message: '承認しました', creator } };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('admin-applications-approve', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'management/applications/{creatorId}/approve',
  handler,
});
