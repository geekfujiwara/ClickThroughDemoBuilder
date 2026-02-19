/**
 * POST /api/auth/apply-designer
 * デザイナー権限申請 (viewer ロールのみ)
 */
import crypto from 'node:crypto';
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as creatorService from '../services/creatorService.js';
import * as emailService from '../services/emailService.js';

function getAppUrl(): string {
  return process.env.APP_URL ?? 'https://your-app.azurestaticapps.net';
}

function buildApprovalToken(creatorId: string): string {
  const secret = process.env.APPROVAL_SECRET ?? 'local-dev-secret';
  const expiry = Math.floor(Date.now() / 1000) + 7 * 24 * 3600; // 7日
  const data = `${creatorId}:${expiry}`;
  const hmac = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return Buffer.from(`${data}:${hmac}`).toString('base64url');
}

async function handler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer');
  if ('status' in auth) return auth;

  const creatorId = auth.payload.creatorId;
  if (!creatorId) return { status: 400, jsonBody: { error: 'creatorId が JWT に含まれていません' } };

  try {
    const body = (await req.json()) as { reason?: string };
    const reason = (body.reason ?? '').trim();
    if (!reason) return { status: 400, jsonBody: { error: '申請理由は必須です' } };

    const creator = await creatorService.applyDesigner(creatorId, reason);
    const token = buildApprovalToken(creatorId);
    const approvalUrl = `${getAppUrl()}/api/creators/${creatorId}/verify?token=${token}`;

    await emailService.sendDesignerApplicationEmail({
      applicantName: creator.name,
      applicantEmail: creator.email ?? '(メールなし)',
      reason,
      approvalUrl,
    }).catch((e) => context.warn('申請メール送信失敗:', (e as Error).message));

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
