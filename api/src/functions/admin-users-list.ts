/**
 * GET /api/admin/users
 * 全ユーザー一覧（user_admin / system_admin 用）
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as creatorService from '../services/creatorService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'user_admin', 'system_admin');
  if ('status' in auth) return auth;

  try {
    const creators = await creatorService.getAllCreators();
    return { status: 200, jsonBody: creators };
  } catch (e) {
    return { status: 500, jsonBody: { error: (e as Error).message } };
  }
}

app.http('admin-users-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/users',
  handler,
});
