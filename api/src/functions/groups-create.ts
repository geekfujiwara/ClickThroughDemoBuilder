/**
 * POST /api/groups
 * グループマスター作成 (designer のみ)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as groupService from '../services/groupService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'designer');
  if ('status' in auth) return auth;

  try {
    const body = (await req.json()) as { name?: string };
    const name = body.name ?? '';
    const group = await groupService.createGroup(name);
    return { status: 201, jsonBody: group };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('groups-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'groups',
  handler,
});
