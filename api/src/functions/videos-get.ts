/**
 * GET /api/videos/{projectId}         → プロキシ URL を返す ({ url })
 * GET /api/videos/{projectId}/stream  → 動画バイトを Range 対応でストリーム配信
 *
 * publicNetworkAccess=Disabled + Private Endpoint 環境ではブラウザが Blob に直接
 * 到達できないため、Function App が Managed Identity で Blob を読み取りブラウザへ中継する。
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { Readable } from 'node:stream';
import { requireRole } from '../middleware/auth.js';
import * as blobService from '../services/blobService.js';
import * as projectService from '../services/projectService.js';

/** ゲストユーザーのアクセス可否を確認 (guestAccessEnabled) */
async function denyGuest(projectId: string, creatorId: string | undefined): Promise<boolean> {
  if (creatorId !== 'guest') return false;
  const project = await projectService.getProject(projectId);
  return !project || project.settings?.guestAccessEnabled === false;
}

/** `Range: bytes=start-end` をパース。無効/未指定は null。 */
function parseRange(header: string | null): { start: number; end?: number } | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const startStr = m[1];
  const endStr = m[2];
  // bytes=-N (末尾N) や空指定は簡易化のため全体扱い (null)
  if (startStr === '') return null;
  const start = parseInt(startStr, 10);
  const end = endStr === '' ? undefined : parseInt(endStr, 10);
  return { start, end };
}

/** GET /api/videos/{projectId} → プロキシ URL */
async function metaHandler(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;

  const projectId = req.params.projectId;
  if (!projectId) return { status: 400, jsonBody: { error: 'projectId は必須です' } };

  try {
    if (await denyGuest(projectId, auth.payload.creatorId)) {
      return { status: 404, jsonBody: { error: '動画が見つかりません' } };
    }
    const exists = await blobService.videoExists(projectId);
    if (!exists) return { status: 404, jsonBody: { error: '動画が見つかりません' } };
    return { status: 200, jsonBody: { url: `/api/videos/${projectId}/stream` } };
  } catch (e) {
    return { status: 500, jsonBody: { error: (e as Error).message } };
  }
}

/** GET /api/videos/{projectId}/stream → Range 対応ストリーム */
async function streamHandler(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'viewer', 'designer');
  if ('status' in auth) return auth;

  const projectId = req.params.projectId;
  if (!projectId) return { status: 400, jsonBody: { error: 'projectId は必須です' } };

  try {
    if (await denyGuest(projectId, auth.payload.creatorId)) {
      return { status: 404, jsonBody: { error: '動画が見つかりません' } };
    }

    const range = parseRange(req.headers.get('range'));
    const result = await blobService.getVideoStream(projectId, range ?? undefined);
    if (!result) return { status: 404, jsonBody: { error: '動画が見つかりません' } };

    const { stream, contentType, contentLength, totalSize, start, end } = result;
    const body = Readable.toWeb(stream as Readable) as unknown as ReadableStream;

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Length': String(contentLength),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    };

    if (range) {
      headers['Content-Range'] = `bytes ${start}-${end}/${totalSize}`;
      return { status: 206, headers, body };
    }
    return { status: 200, headers, body };
  } catch (e) {
    return { status: 500, jsonBody: { error: (e as Error).message } };
  }
}

app.http('videos-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'videos/{projectId}',
  handler: metaHandler,
});

app.http('videos-stream', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'videos/{projectId}/stream',
  handler: streamHandler,
});
