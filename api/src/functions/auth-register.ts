/**
 * POST /api/auth/register
 * 新規アカウント仮登録 → 確認メール送信
 * リクエスト: { email, name, password, language, groupId? }
 * レスポンス: { message }
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import * as creatorService from '../services/creatorService.js';
import * as registrationService from '../services/registrationService.js';
import * as emailService from '../services/emailService.js';

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

    // 仮登録作成
    const pwHash = creatorService.hashPassword(password);
    const token = await registrationService.createPendingRegistration({
      email,
      name,
      passwordHash: pwHash,
      language,
      groupId,
    });

    // 確認メール送信
    await emailService.sendVerificationEmail(email, token, name);

    return {
      status: 200,
      jsonBody: { message: `Verification email sent to ${email}. Please check your inbox.` },
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
