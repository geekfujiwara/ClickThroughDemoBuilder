/**
 * GET /api/auth/me
 * 現在のセッション情報を返す
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { authenticate } from '../middleware/auth.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const payload = authenticate(req);
  if (!payload) {
    return { status: 401, jsonBody: { authenticated: false } };
  }
  return {
    status: 200,
    jsonBody: { authenticated: true, role: payload.role },
  };
}

app.http('auth-me', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/me',
  handler,
});
