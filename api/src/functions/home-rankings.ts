/**
 * GET /api/home/rankings
 * ホーム画面用ランキングデータ
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as projectService from '../services/projectService.js';
import * as socialService from '../services/socialService.js';
import * as creatorService from '../services/creatorService.js';

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;

  const [projects, likes, comments, creators] = await Promise.all([
    projectService.getAllProjects(),
    // 全いいね (demoId -> count)
    socialService.getLikeCountsByCreator(),
    // 全コメント
    (async () => {
      const json = await import('../services/blobService.js').then(b => b.getCommentsJson());
      if (!json) return [] as Array<{ demoId: string }>;
      try { return JSON.parse(json) as Array<{ demoId: string }>; } catch { return []; }
    })(),
    creatorService.getAllCreators(),
  ]);

  // demoId -> likeCount
  const likeMap = likes;

  // demoId -> commentCount
  const commentMap = new Map<string, number>();
  for (const c of comments) {
    commentMap.set(c.demoId, (commentMap.get(c.demoId) ?? 0) + 1);
  }

  // プロジェクトにカウントを付加（groupIdは常に作成者の組織から派生しハードコピーしない）
  const creatorGroupMap = new Map(creators.map((c) => [c.id, c.groupId]));

  const enriched = projects.map(p => ({
    ...p,
    thumbnailDataUrl: p.video?.thumbnailDataUrl ?? '',
    groupId: creatorGroupMap.get(p.creatorId ?? '') ?? p.groupId,
    likeCount: likeMap.get(p.id) ?? 0,
    commentCount: commentMap.get(p.id) ?? 0,
    playCount: p.playCount ?? 0,
    totalPlayDuration: p.totalPlayDuration ?? 0,
  }));

  const top = (arr: typeof enriched, key: keyof typeof enriched[0], n = 5) =>
    [...arr].sort((a, b) => (Number(b[key]) - Number(a[key]))).slice(0, n);

  // creatorId -> totalLikes
  const creatorLikeMap = new Map<string, number>();
  for (const [demoId, count] of likeMap) {
    const project = projects.find(p => p.id === demoId);
    if (project?.creatorId) {
      creatorLikeMap.set(project.creatorId, (creatorLikeMap.get(project.creatorId) ?? 0) + count);
    }
  }

  // creatorId -> demoCount
  const creatorDemoMap = new Map<string, number>();
  for (const p of projects) {
    if (p.creatorId) {
      creatorDemoMap.set(p.creatorId, (creatorDemoMap.get(p.creatorId) ?? 0) + 1);
    }
  }

  const topCreatorsByLikes = creators
    .map(c => ({ ...c, totalLikes: creatorLikeMap.get(c.id) ?? 0 }))
    .sort((a, b) => b.totalLikes - a.totalLikes)
    .slice(0, 5);

  const topCreatorsByDemos = creators
    .map(c => ({ ...c, demoCount: creatorDemoMap.get(c.id) ?? 0 }))
    .sort((a, b) => b.demoCount - a.demoCount)
    .slice(0, 5);

  return {
    status: 200,
    jsonBody: {
      popularByLikes: top(enriched, 'likeCount'),
      recentDemos: [...enriched].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
      popularByPlay: top(enriched, 'playCount'),
      recentComments: await socialService.getFeed(5),
      popularByDuration: top(enriched, 'totalPlayDuration'),
      topCreatorsByLikes,
      topCreatorsByDemos,
    },
  };
}

app.http('home-rankings', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'home/rankings',
  handler,
});
