/**
 * POST /api/usage/demo
 * デモ利用ログを記録 (viewer / designer)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as usageLogService from '../services/usageLogService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;

  try {
    const body = (await req.json()) as { projectId?: string; event?: 'view_start' | 'view_complete' };
    const projectId = body.projectId?.trim();
    const event = body.event ?? 'view_start';

    if (!projectId) {
      return { status: 400, jsonBody: { error: 'projectId は必須です' } };
    }
    if (event !== 'view_start' && event !== 'view_complete') {
      return { status: 400, jsonBody: { error: 'event が不正です' } };
    }

    await usageLogService.logDemoUsage(req, projectId, event);
    return { status: 201, jsonBody: { ok: true } };
  } catch (e) {
    return { status: 500, jsonBody: { error: (e as Error).message } };
  }
}

app.http('usage-demo-log', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'usage/demo',
  handler,
});
