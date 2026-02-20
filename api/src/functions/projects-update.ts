/**
 * PUT /api/projects/{id}
 * プロジェクト更新 (designer のみ)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as projectService from '../services/projectService.js';
import type { DemoProject } from '../shared/types.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'designer');
  if ('status' in auth) return auth;

  const id = req.params.id;
  if (!id) return { status: 400, jsonBody: { error: 'id は必須です' } };

  try {
    // 所有者チェック (IDOR 防止)
    const existing = await projectService.getProject(id);
    if (!existing) return { status: 404, jsonBody: { error: 'プロジェクトが見つかりません' } };
    if (existing.creatorId && existing.creatorId !== auth.payload.creatorId) {
      return { status: 403, jsonBody: { error: '他のデザイナーのプロジェクトは更新できません' } };
    }

    const body = (await req.json()) as DemoProject;
    body.id = id; // URL の id を優先
    body.creatorId = auth.payload.creatorId; // サーバー側で強制
    body.updatedAt = new Date().toISOString();
    await projectService.updateProject(id, body);
    return { status: 200, jsonBody: body };
  } catch {
    return { status: 500, jsonBody: { error: 'プロジェクトの更新に失敗しました' } };
  }
}

app.http('projects-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'projects/{id}',
  handler,
});
