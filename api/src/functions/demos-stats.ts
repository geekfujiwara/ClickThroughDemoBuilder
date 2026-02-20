/**
 * GET /api/demos/{demoId}/stats
 * デモの統計情報を返す (viewer / designer)
 *
 * レスポンス:
 *   {
 *     likeCount, commentCount, playCount, completionCount,
 *     completionRate, totalPlayDuration,
 *     dailyPlays: [{ date, views, completions }],
 *     topSites:   [{ site, count }],
 *   }
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as socialService from '../services/socialService.js';
import * as blob from '../services/blobService.js';

/** 過去 N 日分の "YYYY-MM-DD" 文字列一覧を生成 */
function recentDatePrefixes(days: number): string[] {
  const prefixes: string[] = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    prefixes.push(d.toISOString().slice(0, 10));
  }
  return prefixes;
}

async function handler(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;

  const demoId = req.params['demoId'];
  if (!demoId) return { status: 400, jsonBody: { error: 'demoId が必要です' } };

  try {
    // --- like / comment counts ---
    const [likeCount, comments] = await Promise.all([
      socialService.getLikeCountByDemo(demoId),
      socialService.getCommentsByDemo(demoId),
    ]);

    // --- usage logs (last 30 days) ---
    const prefixes = recentDatePrefixes(30);
    const logs = await blob.getUsageLogsForDays(prefixes);
    const demoLogs = logs.filter((l) => l.demoId === demoId);

    // daily aggregate
    const dailyMap = new Map<string, { views: number; completions: number }>();
    for (const log of demoLogs) {
      const day = log.timestamp.slice(0, 10);
      const entry = dailyMap.get(day) ?? { views: 0, completions: 0 };
      if (log.event === 'view_start') entry.views++;
      if (log.event === 'view_complete') entry.completions++;
      dailyMap.set(day, entry);
    }
    // last 30 days in ascending order (include zeros)
    const dailyPlays = prefixes
      .slice()
      .reverse()
      .map((date) => {
        const e = dailyMap.get(date) ?? { views: 0, completions: 0 };
        return { date, views: e.views, completions: e.completions };
      });

    // top sites
    const siteMap = new Map<string, number>();
    for (const log of demoLogs) {
      if (log.event === 'view_start') {
        siteMap.set(log.site, (siteMap.get(log.site) ?? 0) + 1);
      }
    }
    const topSites = [...siteMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([site, count]) => ({ site, count }));

    const playCount = demoLogs.filter((l) => l.event === 'view_start').length;
    const completionCount = demoLogs.filter((l) => l.event === 'view_complete').length;
    const completionRate = playCount > 0 ? Math.round((completionCount / playCount) * 100) : 0;

    // role breakdown
    const roleMap = new Map<string, number>();
    for (const log of demoLogs) {
      if (log.event === 'view_start') {
        roleMap.set(log.role, (roleMap.get(log.role) ?? 0) + 1);
      }
    }
    const roleBreakdown = [...roleMap.entries()].map(([role, count]) => ({ role, count }));

    return {
      status: 200,
      jsonBody: {
        demoId,
        likeCount,
        commentCount: comments.length,
        playCount,
        completionCount,
        completionRate,
        dailyPlays,
        topSites,
        roleBreakdown,
      },
    };
  } catch (e) {
    return { status: 500, jsonBody: { error: (e as Error).message } };
  }
}

app.http('demos-stats', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'demos/{demoId}/stats',
  handler,
});
