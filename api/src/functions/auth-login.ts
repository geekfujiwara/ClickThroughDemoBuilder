/**
 * POST /api/auth/login
 * パスワード検証 → JWT Cookie 発行
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { verifyPassword, createToken, buildSessionCookie } from '../middleware/auth.js';
import type { UserRole } from '../shared/types.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await req.json()) as { role?: string; password?: string };
    const { role, password } = body;

    if (!role || !password) {
      return { status: 400, jsonBody: { error: 'role と password は必須です' } };
    }
    if (role !== 'viewer' && role !== 'designer') {
      return { status: 400, jsonBody: { error: '無効なロールです' } };
    }

    if (!verifyPassword(role as UserRole, password)) {
      return { status: 401, jsonBody: { error: 'パスワードが正しくありません' } };
    }

    const token = createToken(role as UserRole);
    const maxAge = role === 'viewer' ? 24 * 3600 : 8 * 3600;

    return {
      status: 200,
      headers: { 'Set-Cookie': buildSessionCookie(token, maxAge) },
      jsonBody: { role, message: 'ログインしました' },
    };
  } catch {
    return { status: 400, jsonBody: { error: 'リクエストの解析に失敗しました' } };
  }
}

app.http('auth-login', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/login',
  handler,
});
