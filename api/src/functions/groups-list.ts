/**
 * GET /api/groups
 * グループマスター一覧取得 (designer のみ)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as groupService from '../services/groupService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'designer');
  if ('status' in auth) return auth;

  try {
    const groups = await groupService.getAllGroups();
    return { status: 200, jsonBody: groups };
  } catch (e) {
    return { status: 500, jsonBody: { error: (e as Error).message } };
  }
}

app.http('groups-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'groups',
  handler,
});
