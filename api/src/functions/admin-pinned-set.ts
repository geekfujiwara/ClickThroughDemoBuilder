/**
 * PUT /api/management/pinned
 * ピン留めされたデモ ID の一覧を設定 (system_admin のみ)
 * 追加・削除・並べ替えをまとめて反映する。
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as pinnedService from '../services/pinnedService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'system_admin');
  if ('status' in auth) return auth;

  try {
    const body = (await req.json()) as { demoIds?: unknown };
    if (!Array.isArray(body.demoIds)) {
      return { status: 400, jsonBody: { error: 'demoIds は配列で指定してください' } };
    }
    const demoIds = body.demoIds.filter((id): id is string => typeof id === 'string');
    const result = await pinnedService.setPinnedIds(demoIds);
    return { status: 200, jsonBody: result };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('admin-pinned-set', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'management/pinned',
  handler,
});
