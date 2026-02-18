/**
 * DELETE /api/creators/{id}
 * 作成者マスター削除 (designer のみ)
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
    await creatorService.deleteCreator(id);
    return { status: 200, jsonBody: { message: '削除しました' } };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('creators-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'creators/{id}',
  handler,
});
