/**
 * POST /api/admin/applications/{creatorId}/reject
 * デザイナー権限申請を拒否（user_admin / system_admin 用）
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as creatorService from '../services/creatorService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'user_admin', 'system_admin');
  if ('status' in auth) return auth;

  const creatorId = req.params['creatorId'];
  if (!creatorId) return { status: 400, jsonBody: { error: 'creatorId は必須です' } };

  try {
    const creator = await creatorService.rejectDesigner(creatorId);
    return { status: 200, jsonBody: { message: '申請を拒否しました', creator } };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('admin-applications-reject', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'management/applications/{creatorId}/reject',
  handler,
});
