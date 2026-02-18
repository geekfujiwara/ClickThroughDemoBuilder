/**
 * GET /api/creators/{id}
 * 作成者単体取得（認証済みユーザーが自分の情報を取得するために使用）
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as creatorService from '../services/creatorService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;

  const id = req.params.id;
  if (!id) return { status: 400, jsonBody: { error: 'id は必須です' } };

  try {
    const creator = await creatorService.getCreatorById(id);
    if (!creator) return { status: 404, jsonBody: { error: '作成者が見つかりません' } };
    return { status: 200, jsonBody: creator };
  } catch (e) {
    return { status: 500, jsonBody: { error: (e as Error).message } };
  }
}

app.http('creators-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'creators/{id}',
  handler,
});
