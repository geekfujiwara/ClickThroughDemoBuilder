/**
 * POST /api/auth/register
 * 新規アカウント登録（@microsoft.com ドメインのみ許可、即時有効化）
 * リクエスト: { email, name, password, language, groupId? }
 * レスポンス: { role, creatorId, name }
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import * as creatorService from '../services/creatorService.js';
import { createToken, buildSessionCookie } from '../middleware/auth.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await req.json()) as {
      email?: string;
      name?: string;
      password?: string;
      language?: string;
      groupId?: string;
    };

    const email = body.email?.trim().toLowerCase() ?? '';
    const name = body.name?.trim() ?? '';
    const password = body.password ?? '';
    const language = body.language === 'en' ? 'en' : 'ja';
    const groupId = body.groupId?.trim() || undefined;

    if (!email) return { status: 400, jsonBody: { error: 'Email is required.' } };
    if (!name) return { status: 400, jsonBody: { error: 'Display name is required.' } };
    if (!password) return { status: 400, jsonBody: { error: 'Password is required.' } };

    // @microsoft.com のみ許可
    if (!email.endsWith('@microsoft.com')) {
      return { status: 400, jsonBody: { error: 'Only @microsoft.com email addresses are allowed.' } };
    }

    // 既存アカウント確認
    const existing = await creatorService.findCreatorByEmail(email);
    if (existing) {
      return { status: 409, jsonBody: { error: 'An account with this email already exists.' } };
    }

    // アカウントを即時作成
    const passwordHash = creatorService.hashPassword(password);
    const creator = await creatorService.createCreatorFromVerification({
      email,
      name,
      passwordHash,
      language,
      groupId,
    });

    // JWT 発行してそのままログイン状態に
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

app.http('auth-register', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/register',
  handler,
});
