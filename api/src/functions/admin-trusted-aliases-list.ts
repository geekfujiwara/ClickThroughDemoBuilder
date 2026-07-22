/**
 * GET /api/manage/trusted-aliases
 * 信頼済みエイリアス一覧取得 (system_admin のみ)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as trustedAliasService from '../services/trustedAliasService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'system_admin');
  if ('status' in auth) return auth;

  try {
    const aliases = await trustedAliasService.listAliases();
    return { status: 200, jsonBody: aliases };
  } catch (e) {
    console.error('[admin-trusted-aliases-list]', e);
    return { status: 500, jsonBody: { error: 'サーバーエラーが発生しました' } };
  }
}

app.http('admin-trusted-aliases-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'management/trusted-aliases',
  handler,
});
