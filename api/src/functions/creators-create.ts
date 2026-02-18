/**
 * POST /api/creators
 * 作成者マスター作成 (designer のみ)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as creatorService from '../services/creatorService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'designer');
  if ('status' in auth) return auth;

  try {
    const body = (await req.json()) as { name?: string };
    const name = body.name ?? '';
    const creator = await creatorService.createCreator(name);
    return { status: 201, jsonBody: creator };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('creators-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'creators',
  handler,
});
