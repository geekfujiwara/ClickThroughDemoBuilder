/**
 * POST /api/manage/trusted-aliases
 * 信頼済みエイリアスを追加または更新 (system_admin のみ)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as trustedAliasService from '../services/trustedAliasService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'system_admin');
  if ('status' in auth) return auth;

  try {
    const body = (await req.json()) as { alias?: string; role?: string };
    if (!body.alias || typeof body.alias !== 'string') {
      return { status: 400, jsonBody: { error: 'alias は必須です' } };
    }
    const role = body.role as 'designer' | 'user_admin';
    if (!['designer', 'user_admin'].includes(role)) {
      return { status: 400, jsonBody: { error: 'role は "designer" または "user_admin" を指定してください' } };
    }

    const result = await trustedAliasService.upsertAlias(body.alias, role);
    return { status: 200, jsonBody: result };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('admin-trusted-aliases-add', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/trusted-aliases',
  handler,
});
