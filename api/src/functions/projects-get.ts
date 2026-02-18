/**
 * GET /api/projects/{id}
 * プロジェクト詳細取得 (viewer / designer)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as projectService from '../services/projectService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;

  const id = req.params.id;
  if (!id) return { status: 400, jsonBody: { error: 'id は必須です' } };

  try {
    const project = await projectService.getProject(id);
    if (!project) return { status: 404, jsonBody: { error: 'プロジェクトが見つかりません' } };
    return { status: 200, jsonBody: project };
  } catch (e) {
    return { status: 500, jsonBody: { error: (e as Error).message } };
  }
}

app.http('projects-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'projects/{id}',
  handler,
});
