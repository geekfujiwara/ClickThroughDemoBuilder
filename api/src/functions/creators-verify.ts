/**
 * POST /api/creators/{creatorId}/verify?token=<signed-token>
 * デザイナー権限承認（管理者用リンク経由）
 */
import crypto from 'node:crypto';
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import * as creatorService from '../services/creatorService.js';
import * as emailService from '../services/emailService.js';
import * as socialService from '../services/socialService.js';

function verifyApprovalToken(creatorId: string, token: string): boolean {
  try {
    const secret = process.env.APPROVAL_SECRET ?? 'local-dev-secret';
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;
    const [id, expiry, hmac] = parts as [string, string, string];
    if (id !== creatorId) return false;
    if (Number(expiry) < Math.floor(Date.now() / 1000)) return false;
    const data = `${id}:${expiry}`;
    const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function handler(req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const creatorId = req.params['creatorId'];
  const token = req.query.get('token') ?? '';

  if (!creatorId || !token) {
    return { status: 400, jsonBody: { error: 'creatorId と token が必要です' } };
  }

  if (!verifyApprovalToken(creatorId, token)) {
    return { status: 401, jsonBody: { error: 'トークンが無効または期限切れです' } };
  }

  try {
    const creator = await creatorService.verifyDesigner(creatorId);

    // フィードに追加
    await socialService.addFeedEntry('new_designer', creator.id, creator.name).catch(
      (e) => context.warn('Feed entry error:', (e as Error).message),
    );

    // 承認メール（失敗しても 200 を返す）
    if (creator.email) {
      await emailService.sendDesignerApprovalEmail(creator.email, creator.name).catch(
        (e) => context.warn('承認メール送信失敗:', (e as Error).message),
      );
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2 style="color:#0078d4">デザイナー権限を承認しました</h2>
        <p>${escapeHtml(creator.name)} さんにデザイナー権限が付与されました。</p>
      </body></html>`,
    };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('creators-verify', {
  methods: ['POST', 'GET'],
  authLevel: 'anonymous',
  route: 'creators/{creatorId}/verify',
  handler,
});
