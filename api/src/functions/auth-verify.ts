/**
 * POST /api/auth/verify
 * メール確認トークンを受取り、アカウントを作成して JWT を発行する
 * リクエスト: { token }
 * レスポンス: { role, creatorId, name }
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import * as registrationService from '../services/registrationService.js';
import * as creatorService from '../services/creatorService.js';
import { createToken, buildSessionCookie } from '../middleware/auth.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await req.json()) as { token?: string };
    const token = body.token?.trim();
    if (!token) {
      return { status: 400, jsonBody: { error: 'Token is required.' } };
    }

    // トークンを検証して仮登録情報を取得（一度だけ使用可）
    const pending = await registrationService.consumeVerificationToken(token);
    if (!pending) {
      return { status: 400, jsonBody: { error: 'Invalid or expired verification token.' } };
    }

    // 既に同じ email のアカウントがある場合
    const existing = await creatorService.findCreatorByEmail(pending.email);
    if (existing) {
      return { status: 409, jsonBody: { error: 'An account with this email already exists.' } };
    }

    // アカウントを正式作成（passwordHash を直接書き込む）
    const creator = await creatorService.createCreatorFromVerification({
      email: pending.email,
      name: pending.name,
      passwordHash: pending.passwordHash,
      language: pending.language,
      groupId: pending.groupId,
    });

    // JWT 発行（creatorId 付き）
    const jwt = createToken('designer', creator.id);
    return {
      status: 200,
      headers: { 'Set-Cookie': buildSessionCookie(jwt, 8 * 3600) },
      jsonBody: { role: 'designer', creatorId: creator.id, name: creator.name },
    };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('auth-verify', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/verify',
  handler,
});
