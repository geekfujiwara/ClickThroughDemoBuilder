/**
 * PUT /api/creators/{id}
 * 作成者マスター更新 (designer のみ)
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
    const body = (await req.json()) as { name?: string; groupId?: string; language?: 'ja' | 'en'; email?: string };
    const name = body.name ?? '';
    const groupId = typeof body.groupId === 'string' && body.groupId.trim() ? body.groupId : undefined;
    const language = body.language === 'en' ? 'en' : 'ja';
    const email = typeof body.email === 'string' ? body.email : undefined;
    const creator = await creatorService.updateCreator(id, { name, groupId, language, email });
    return { status: 200, jsonBody: creator };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('creators-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'creators/{id}',
  handler,
});
