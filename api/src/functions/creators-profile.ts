/**
 * GET /api/creators/{creatorId}/profile
 * ユーザーの公開プロフィール + 公開デモ + 統計サマリを返す (viewer / designer)
 *
 * レスポンス:
 *   {
 *     creator: { id, name, groupId, color, bio, xUrl, linkedInUrl, youTubeUrl, ... },
 *     stats: { demoCount, totalLikes, totalPlays, totalComments, totalPlayDuration },
 *     demos: DemoSummary[]
 *   }
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as creatorService from '../services/creatorService.js';
import * as projectService from '../services/projectService.js';
import * as socialService from '../services/socialService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;

  const creatorId = req.params['creatorId'];
  if (!creatorId) return { status: 400, jsonBody: { error: 'creatorId が必要です' } };

  try {
    const creator = await creatorService.getCreatorById(creatorId);
    if (!creator) return { status: 404, jsonBody: { error: 'プロフィールが見つかりません' } };

    // このユーザーが作成したデモを収集
    const projects = await projectService.getAllProjects();
    const ownDemos = projects.filter((p) => p.creatorId === creatorId);

    // デモごとの いいね数 / コメント数 を集計
    const demos = await Promise.all(
      ownDemos.map(async (p) => {
        const [likeCount, commentCount] = await Promise.all([
          socialService.getLikeCountByDemo(p.id),
          socialService.getCommentCountByDemo(p.id),
        ]);
        return {
          id: p.id,
          demoNumber: p.demoNumber,
          title: p.title,
          description: p.description ?? '',
          groupId: p.groupId,
          creatorId: p.creatorId,
          thumbnailDataUrl: p.video?.thumbnailDataUrl ?? '',
          clickPointCount: p.clickPoints?.length ?? 0,
          duration: p.video?.duration ?? 0,
          updatedAt: p.updatedAt,
          createdAt: p.createdAt,
          likeCount,
          commentCount,
          playCount: p.playCount ?? 0,
          totalPlayDuration: p.totalPlayDuration ?? 0,
        };
      }),
    );

    // 統計サマリ
    const stats = demos.reduce(
      (acc, d) => {
        acc.totalLikes += d.likeCount;
        acc.totalComments += d.commentCount;
        acc.totalPlays += d.playCount;
        acc.totalPlayDuration += d.totalPlayDuration;
        return acc;
      },
      { demoCount: demos.length, totalLikes: 0, totalComments: 0, totalPlays: 0, totalPlayDuration: 0 },
    );

    // 新しい順に並べる
    demos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      status: 200,
      jsonBody: { creator, stats, demos },
    };
  } catch (e) {
    return { status: 500, jsonBody: { error: (e as Error).message } };
  }
}

app.http('creators-profile', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'creators/{creatorId}/profile',
  handler,
});
