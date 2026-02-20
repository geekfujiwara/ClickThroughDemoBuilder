/**
 * PUT /api/groups/{id}
 * グループマスター更新 (designer のみ)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as groupService from '../services/groupService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'designer');
  if ('status' in auth) return auth;

  const id = req.params.id;
  if (!id) return { status: 400, jsonBody: { error: 'id は必須です' } };

  try {
    const body = (await req.json()) as { name?: string; color?: string };
    const name = body.name ?? '';
    const color = typeof body.color === 'string' ? body.color : undefined;
    const group = await groupService.updateGroup(id, name, color);
    return { status: 200, jsonBody: group };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('groups-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'groups/{id}',
  handler,
});
