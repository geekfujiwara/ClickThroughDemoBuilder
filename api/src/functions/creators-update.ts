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
    const body = (await req.json()) as {
      name?: string;
      groupId?: string;
      language?: 'ja' | 'en';
      email?: string;
      color?: string;
      bio?: string;
      xUrl?: string;
      linkedInUrl?: string;
      youTubeUrl?: string;
    };
    const name = body.name ?? '';
    const groupId = typeof body.groupId === 'string' && body.groupId.trim() ? body.groupId : undefined;
    const language = body.language === 'en' ? 'en' : 'ja';
    const email = typeof body.email === 'string' ? body.email : undefined;
    const color = typeof body.color === 'string' ? body.color : undefined;
    const bio = typeof body.bio === 'string' ? body.bio : undefined;
    const xUrl = typeof body.xUrl === 'string' ? body.xUrl : undefined;
    const linkedInUrl = typeof body.linkedInUrl === 'string' ? body.linkedInUrl : undefined;
    const youTubeUrl = typeof body.youTubeUrl === 'string' ? body.youTubeUrl : undefined;
    const creator = await creatorService.updateCreator(id, {
      name, groupId, language, email, color, bio, xUrl, linkedInUrl, youTubeUrl,
    });
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
