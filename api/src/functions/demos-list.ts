/**
 * GET /api/demos
 * 公開デモ一覧 (viewer 用) — 動画ありのプロジェクトのみ
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as projectService from '../services/projectService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;

  try {
    const all = await projectService.getAllProjects();
    // Viewer 用: 動画が設定されているプロジェクトのみ、必要最低限のフィールドを返す
    const demos = all
      .filter((p) => p.video && p.video.videoId)
      .map((p) => ({
        id: p.id,
        demoNumber: p.demoNumber,
        title: p.title,
        description: p.description,
        thumbnailDataUrl: p.video.thumbnailDataUrl,
        clickPointCount: p.clickPoints.length,
        duration: p.video.duration,
        updatedAt: p.updatedAt,
      }));
    return { status: 200, jsonBody: demos };
  } catch (e) {
    return { status: 500, jsonBody: { error: (e as Error).message } };
  }
}

app.http('demos-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'demos',
  handler,
});
