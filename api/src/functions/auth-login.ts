/**
 * POST /api/auth/login
 * role + password → 旧来の共有パスワード方式（viewer 互換）
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { verifyPassword, createToken, buildSessionCookie } from '../middleware/auth.js';
import type { UserRole } from '../shared/types.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await req.json()) as { password?: string; role?: string };

    const { role, password } = body;
    if (!role || !password) {
      return { status: 400, jsonBody: { error: 'role and password are required.' } };
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
