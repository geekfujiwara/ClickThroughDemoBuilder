/**
 * PUT /api/admin/users/{creatorId}/block
 * ユーザーのブロック/ブロック解除（system_admin のみ）
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as creatorService from '../services/creatorService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'system_admin');
  if ('status' in auth) return auth;

  const creatorId = req.params['creatorId'];
  if (!creatorId) return { status: 400, jsonBody: { error: 'creatorId は必須です' } };

  try {
    const body = (await req.json()) as { blocked?: boolean };
    if (typeof body.blocked !== 'boolean') {
      return { status: 400, jsonBody: { error: 'blocked (boolean) は必須です' } };
    }

    const creator = body.blocked
      ? await creatorService.blockUser(creatorId)
      : await creatorService.unblockUser(creatorId);

    return { status: 200, jsonBody: creator };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('admin-users-block', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'admin/users/{creatorId}/block',
  handler,
});
