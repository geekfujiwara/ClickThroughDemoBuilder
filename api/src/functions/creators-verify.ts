/**
 * POST /api/creators/{id}/verify
 * 作成者のパスワードを照合する（viewer / designer どちらも可）
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
    const body = (await req.json()) as { password?: string };
    const password = body.password ?? '';
    const ok = await creatorService.verifyCreatorPassword(id, password);
    if (!ok) return { status: 401, jsonBody: { error: 'Incorrect password.' } };
    return { status: 200, jsonBody: { ok: true } };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('creators-verify', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'creators/{id}/verify',
  handler,
});
