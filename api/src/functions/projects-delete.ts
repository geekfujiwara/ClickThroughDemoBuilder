/**
 * DELETE /api/projects/{id}
 * プロジェクト削除 (designer のみ) — JSON + 動画ファイルも削除
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as projectService from '../services/projectService.js';

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
      return { status: 403, jsonBody: { error: '他のデザイナーのプロジェクトは削除できません' } };
    }

    await projectService.deleteProject(id);
    return { status: 200, jsonBody: { message: '削除しました' } };
  } catch {
    return { status: 500, jsonBody: { error: 'プロジェクトの削除に失敗しました' } };
  }
}

app.http('projects-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'projects/{id}',
  handler,
});
