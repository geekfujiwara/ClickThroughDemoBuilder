/**
 * GET /api/admin/applications
 * デザイナー権限申請一覧取得（user_admin / system_admin 用）
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as creatorService from '../services/creatorService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'user_admin', 'system_admin');
  if ('status' in auth) return auth;

  try {
    const applications = await creatorService.getPendingApplications();
    return { status: 200, jsonBody: applications };
  } catch (e) {
    console.error('[admin-applications-list]', e);
    return { status: 500, jsonBody: { error: 'サーバーエラーが発生しました' } };
  }
}

app.http('admin-applications-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'management/applications',
  handler,
});
