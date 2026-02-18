/**
 * GET /api/creators
 * 作成者マスター一覧取得 (designer のみ)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as creatorService from '../services/creatorService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'designer');
  if ('status' in auth) return auth;

  try {
    const creators = await creatorService.getAllCreators();
    return { status: 200, jsonBody: creators };
  } catch (e) {
    return { status: 500, jsonBody: { error: (e as Error).message } };
  }
}

app.http('creators-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'creators',
  handler,
});
