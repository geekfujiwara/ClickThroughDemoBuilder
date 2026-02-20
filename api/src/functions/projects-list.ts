/**
 * GET /api/projects
 * プロジェクト一覧取得 (designer のみ)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as projectService from '../services/projectService.js';
import * as creatorService from '../services/creatorService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'designer');
  if ('status' in auth) return auth;

  try {
    const [projects, creators] = await Promise.all([
      projectService.getAllProjects(),
      creatorService.getAllCreators(),
    ]);

    // creatorId -> groupId マップ（常に作成者の組織を参照）
    const creatorGroupMap = new Map(creators.map((c) => [c.id, c.groupId]));

    const enriched = projects.map((p) => ({
      ...p,
      groupId: creatorGroupMap.get(p.creatorId ?? '') ?? p.groupId,
    }));

    return { status: 200, jsonBody: enriched };
  } catch (e) {
    return { status: 500, jsonBody: { error: (e as Error).message } };
  }
}

app.http('projects-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'projects',
  handler,
});
