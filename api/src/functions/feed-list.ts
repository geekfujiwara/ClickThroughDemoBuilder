/**
 * GET /api/feed?limit=20&before=<cursor>
 * フィード一覧
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as socialService from '../services/socialService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;

  const limitStr = req.query.get('limit') ?? '20';
  const limit = Math.min(Math.max(1, parseInt(limitStr, 10) || 20), 50);
  const before = req.query.get('before') ?? undefined;

  const entries = await socialService.getFeed(limit, before);
  return { status: 200, jsonBody: entries };
}

app.http('feed-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'feed',
  handler,
});
