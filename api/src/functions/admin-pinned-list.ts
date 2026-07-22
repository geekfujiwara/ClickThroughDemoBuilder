/**
 * GET /api/management/pinned
 * ピン留めされたデモ ID の一覧を取得 (system_admin のみ)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as pinnedService from '../services/pinnedService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'system_admin');
  if ('status' in auth) return auth;

  try {
    const demoIds = await pinnedService.listPinnedIds();
    return { status: 200, jsonBody: demoIds };
  } catch (e) {
    console.error('[admin-pinned-list]', e);
    return { status: 500, jsonBody: { error: 'サーバーエラーが発生しました' } };
  }
}

app.http('admin-pinned-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'management/pinned',
  handler,
});
