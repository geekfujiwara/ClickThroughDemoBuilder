/**
 * PUT /api/manage/users/{creatorId}/group
 * ユーザーの所属組織を変更
 * - user_admin / system_admin のみ
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as creatorService from '../services/creatorService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'user_admin', 'system_admin');
  if ('status' in auth) return auth;

  const creatorId = req.params['creatorId'];
  if (!creatorId) return { status: 400, jsonBody: { error: 'creatorId は必須です' } };

  try {
    const body = (await req.json()) as { groupId?: string | null };
    const groupId = body.groupId !== undefined ? (body.groupId || null) : null;

    const creator = await creatorService.changeUserGroup(creatorId, groupId);
    return { status: 200, jsonBody: creator };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('admin-users-group', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'manage/users/{creatorId}/group',
  handler,
});
