/**
 * POST /api/auth/guest
 * ゲストモード ログイン — ID/パスワード認証
 * 環境変数 GUEST_LOGIN_ID / GUEST_LOGIN_PASSWORD で資格情報を管理
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { createToken, buildSessionCookie } from '../middleware/auth.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await req.json()) as { loginId?: string; password?: string };
    const loginId = body.loginId?.trim();
    const password = body.password;

    if (!loginId || !password) {
      return { status: 400, jsonBody: { error: 'loginId と password は必須です' } };
    }

    const expectedId = (process.env.GUEST_LOGIN_ID ?? '').trim();
    const expectedPw = (process.env.GUEST_LOGIN_PASSWORD ?? '').trim();

    if (!expectedId || !expectedPw) {
      return { status: 503, jsonBody: { error: 'ゲストログインは現在利用できません' } };
    }

    // タイミング攻撃を軽減するため、両方チェックしてから判定
    const idMatch = loginId === expectedId;
    const pwMatch = password === expectedPw;
    if (!idMatch || !pwMatch) {
      return { status: 401, jsonBody: { error: 'ID またはパスワードが正しくありません' } };
    }

    // ゲストユーザーは viewer ロール、creatorId は 'guest' 固定
    const token = createToken('viewer', 'guest');
    const maxAge = 24 * 60 * 60; // 24h

    return {
      status: 200,
      headers: { 'Set-Cookie': buildSessionCookie(token, maxAge) },
      jsonBody: {
        role: 'viewer',
        creatorId: 'guest',
        name: 'ゲスト',
        isGuest: true,
      },
    };
  } catch {
    return { status: 500, jsonBody: { error: 'ゲストログインに失敗しました' } };
  }
}

app.http('auth-guest', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/guest',
  handler,
});
