/**
 * POST /api/auth/logout
 * Cookie 削除
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { buildClearCookie } from '../middleware/auth.js';

async function handler(_req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  return {
    status: 200,
    headers: { 'Set-Cookie': buildClearCookie() },
    jsonBody: { message: 'ログアウトしました' },
  };
}

app.http('auth-logout', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/logout',
  handler,
});
