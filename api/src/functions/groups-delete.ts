/**
 * DELETE /api/groups/{id}
 * グループマスター削除 (designer のみ)
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
    await groupService.deleteGroup(id);
    return { status: 200, jsonBody: { message: '削除しました' } };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('groups-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'groups/{id}',
  handler,
});
