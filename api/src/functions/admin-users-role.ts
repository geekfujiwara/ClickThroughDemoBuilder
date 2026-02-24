/**
 * PUT /api/admin/users/{creatorId}/role
 * ユーザーのロール変更
 * - system_admin: viewer / designer / user_admin / system_admin に変更可能
 * - user_admin: viewer / designer のみ変更可能
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import type { UserRole } from '../shared/types.js';
import * as creatorService from '../services/creatorService.js';
import * as socialService from '../services/socialService.js';

const VALID_ROLES: UserRole[] = ['viewer', 'designer', 'user_admin', 'system_admin'];
const USER_ADMIN_ASSIGNABLE: UserRole[] = ['viewer', 'designer'];

async function handler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'user_admin', 'system_admin');
  if ('status' in auth) return auth;

  const creatorId = req.params['creatorId'];
  if (!creatorId) return { status: 400, jsonBody: { error: 'creatorId は必須です' } };

  try {
    const body = (await req.json()) as { role?: string };
    const newRole = body.role as UserRole;
    if (!newRole || !VALID_ROLES.includes(newRole)) {
      return { status: 400, jsonBody: { error: '無効なロールです' } };
    }

    // user_admin は viewer / designer のみ割当可能
    if (auth.payload.role === 'user_admin' && !USER_ADMIN_ASSIGNABLE.includes(newRole)) {
      return { status: 403, jsonBody: { error: 'ユーザー管理者は viewer / designer 権限のみ変更できます' } };
    }

    const creator = await creatorService.changeUserRole(creatorId, newRole);

    // designer 以上への昇格時はフィードに追加
    if (newRole === 'designer') {
      await socialService.addFeedEntry('new_designer', creator.id, creator.name).catch(
        (e) => context.warn('Feed entry error:', (e as Error).message),
      );
    }

    return { status: 200, jsonBody: creator };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('admin-users-role', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'manage/users/{creatorId}/role',
  handler,
});
