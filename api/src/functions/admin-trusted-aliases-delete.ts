/**
 * DELETE /api/manage/trusted-aliases/{alias}
 * 信頼済みエイリアスを削除 (system_admin のみ)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as trustedAliasService from '../services/trustedAliasService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'system_admin');
  if ('status' in auth) return auth;

  const alias = req.params['alias'];
  if (!alias) return { status: 400, jsonBody: { error: 'alias は必須です' } };

  try {
    await trustedAliasService.removeAlias(alias);
    return { status: 200, jsonBody: { message: `エイリアス "${alias}" を削除しました` } };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('admin-trusted-aliases-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'management/trusted-aliases/{alias}',
  handler,
});
