/**
 * POST /api/projects/{id}/duplicate
 * プロジェクト複製 (designer のみ)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as projectService from '../services/projectService.js';
import crypto from 'node:crypto';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'designer');
  if ('status' in auth) return auth;

  const id = req.params.id;
  if (!id) return { status: 400, jsonBody: { error: 'id は必須です' } };

  try {
    const newId = crypto.randomUUID();
    const dup = await projectService.duplicateProject(id, newId);
    if (!dup) return { status: 404, jsonBody: { error: 'プロジェクトが見つかりません' } };
    return { status: 201, jsonBody: dup };
  } catch (e) {
    return { status: 500, jsonBody: { error: (e as Error).message } };
  }
}

app.http('projects-duplicate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'projects/{id}/duplicate',
  handler,
});
