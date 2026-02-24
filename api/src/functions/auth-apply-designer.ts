/**
 * POST /api/auth/apply-designer
 * デザイナー権限申請 (viewer ロールのみ)
 * ※ メール通知は廃止。管理者がアプリ内で承認・否認する。
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as creatorService from '../services/creatorService.js';

async function handler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer');
  if ('status' in auth) return auth;

  const creatorId = auth.payload.creatorId;
  if (!creatorId) return { status: 400, jsonBody: { error: 'creatorId が JWT に含まれていません' } };

  try {
    const body = (await req.json()) as { reason?: string };
    const reason = (body.reason ?? '').trim();
    if (!reason) return { status: 400, jsonBody: { error: '申請理由は必須です' } };
    if (reason.length > 500) return { status: 400, jsonBody: { error: '申請理由は500文字以内です' } };

    const creator = await creatorService.applyDesigner(creatorId, reason);

    return { status: 200, jsonBody: { message: '申請を受け付けました', creator } };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('auth-apply-designer', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/apply-designer',
  handler,
});
