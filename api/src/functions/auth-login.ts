/**
 * POST /api/auth/login
 * A: email + password → designer ログイン（作成者単位）
 * B: role + password  → 旧来の共有パスワード方式（viewer 互換）
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { verifyPassword, createToken, buildSessionCookie } from '../middleware/auth.js';
import * as creatorService from '../services/creatorService.js';
import type { UserRole } from '../shared/types.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await req.json()) as { email?: string; password?: string; role?: string };

    // ── A: email + password（作成者ログイン） ──
    if (body.email) {
      const email = body.email.trim().toLowerCase();
      const password = body.password ?? '';
      const creator = await creatorService.findCreatorByEmail(email);
      if (!creator) {
        return { status: 401, jsonBody: { error: 'Invalid email or password.' } };
      }
      const ok = await creatorService.verifyCreatorPasswordById(creator.id, password);
      if (!ok) {
        return { status: 401, jsonBody: { error: 'Invalid email or password.' } };
      }
      const token = createToken('designer', creator.id);
      return {
        status: 200,
        headers: { 'Set-Cookie': buildSessionCookie(token, 8 * 3600) },
        jsonBody: { role: 'designer', creatorId: creator.id, name: creator.name },
      };
    }

    // ── B: role + password（旧来方式） ──
    const { role, password } = body;
    if (!role || !password) {
      return { status: 400, jsonBody: { error: 'email or (role + password) is required.' } };
    }
    if (role !== 'viewer' && role !== 'designer') {
      return { status: 400, jsonBody: { error: 'Invalid role.' } };
    }
    if (!verifyPassword(role as UserRole, password)) {
      return { status: 401, jsonBody: { error: 'Incorrect password.' } };
    }
    const token = createToken(role as UserRole);
    const maxAge = role === 'viewer' ? 24 * 3600 : 8 * 3600;
    return {
      status: 200,
      headers: { 'Set-Cookie': buildSessionCookie(token, maxAge) },
      jsonBody: { role, message: 'Logged in.' },
    };
  } catch (e) {
    return { status: 400, jsonBody: { error: (e as Error).message } };
  }
}

app.http('auth-login', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/login',
  handler,
});
