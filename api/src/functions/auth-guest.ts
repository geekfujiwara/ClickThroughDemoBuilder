/**
 * POST /api/auth/guest
 * ゲストモード ログイン — ID/パスワード認証
 * 環境変数 GUEST_LOGIN_ID / GUEST_LOGIN_PASSWORD で資格情報を管理
 */
import crypto from 'node:crypto';
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { createToken, buildSessionCookie, getClientIp } from '../middleware/auth.js';

/** 長さ情報を漏らさない定数時間比較 (SHA-256 で固定長化してから比較) */
function constantTimeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ── 簡易レート制限 (ベストエフォート: インスタンス単位のメモリ) ──────────
// サーバーレスで完全ではないが、総当たりに対する摩擦を与える。
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 10 * 60 * 1000; // 10分
const attempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.resetAt) {
    attempts.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return true;
  }
  return rec.count < MAX_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    rec.count += 1;
  }
}

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) {
      return {
        status: 429,
        jsonBody: { error: '試行回数が多すぎます。しばらくしてから再試行してください' },
      };
    }

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

    // タイミング攻撃を軽減するため、両方を定数時間比較してから判定
    const idMatch = constantTimeEqual(loginId, expectedId);
    const pwMatch = constantTimeEqual(password, expectedPw);
    if (!idMatch || !pwMatch) {
      recordFailure(ip);
      return { status: 401, jsonBody: { error: 'ID またはパスワードが正しくありません' } };
    }

    // 成功時は失敗カウンタをリセット
    attempts.delete(ip);

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
