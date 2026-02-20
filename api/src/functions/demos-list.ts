/**
 * GET /api/demos
 * 公開デモ一覧 (viewer 用) — 動画ありのプロジェクトのみ
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as projectService from '../services/projectService.js';
import * as socialService from '../services/socialService.js';
import * as creatorService from '../services/creatorService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;

  try {
    const [all, likeMap, creators] = await Promise.all([
      projectService.getAllProjects(),
      socialService.getLikeCountsByCreator(),
      creatorService.getAllCreators(),
    ]);

    // creatorId -> groupId マップ（常に作成者の組織を参照）
    const creatorGroupMap = new Map(creators.map((c) => [c.id, c.groupId]));

    // Viewer 用: 動画が設定されているプロジェクトのみ
    const demos = await Promise.all(
      all
        .filter((p) => p.video && p.video.videoId)
        .map(async (p) => ({
          id: p.id,
          demoNumber: p.demoNumber,
          title: p.title,
          description: p.description,
          groupId: creatorGroupMap.get(p.creatorId ?? '') ?? p.groupId,
          creatorId: p.creatorId,
          thumbnailDataUrl: p.video.thumbnailDataUrl,
          clickPointCount: p.clickPoints.length,
          duration: p.video.duration,
          updatedAt: p.updatedAt,
          createdAt: p.createdAt,
          likeCount: likeMap.get(p.id) ?? 0,
          commentCount: await socialService.getCommentCountByDemo(p.id),
          playCount: p.playCount ?? 0,
        })),
    );
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
