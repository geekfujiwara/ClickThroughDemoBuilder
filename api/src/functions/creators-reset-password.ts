/**
 * POST /api/creators/{id}/reset-password
 * パスワードをランダム英数字にリセットし、新パスワードを返す (designer のみ)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as creatorService from '../services/creatorService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'designer');
  if ('status' in auth) return auth;

  const id = req.params.id;
  if (!id) return { status: 400, jsonBody: { error: 'id は必須です' } };

  try {
    const result = await creatorService.resetCreatorPassword(id);
    return { status: 200, jsonBody: result };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('creators-reset-password', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'creators/{id}/reset-password',
  handler,
});
