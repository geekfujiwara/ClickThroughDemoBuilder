/**
 * POST /api/videos/upload
 *
 * 2つのモード:
 *   1. JSON body { projectId, mimeType } → SAS URL を返す (クライアント直接アップロード)
 *   2. multipart/form-data で直接アップロード (フォールバック)
 */
import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { requireRole } from '../middleware/auth.js';
import * as blobService from '../services/blobService.js';

function extFromMime(mime: string): string {
  if (mime === 'video/webm') return 'webm';
  return 'mp4';
}

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'designer');
  if ('status' in auth) return auth;

  const contentType = req.headers.get('content-type') ?? '';

  // ── JSON モード: SAS URL 返却 ────────────────────────────
  if (contentType.includes('application/json')) {
    try {
      const body = (await req.json()) as { projectId?: string; mimeType?: string };
      if (!body.projectId || !body.mimeType) {
        return { status: 400, jsonBody: { error: 'projectId と mimeType は必須です' } };
      }
      const ext = extFromMime(body.mimeType);

      // 既存動画を削除
      await blobService.deleteProjectVideo(body.projectId);

      const { uploadUrl, blobName } = await blobService.getVideoUploadSasUrl(body.projectId, ext);
      return {
        status: 200,
        jsonBody: { uploadUrl, blobName, projectId: body.projectId },
      };
    } catch (e) {
      return { status: 500, jsonBody: { error: (e as Error).message } };
    }
  }

  // ── Binary モード: 直接アップロード ──────────────────────
  try {
    const projectId = req.query.get('projectId');
    const mimeType = req.query.get('mimeType') ?? 'video/mp4';
    if (!projectId) {
      return { status: 400, jsonBody: { error: 'projectId クエリパラメータは必須です' } };
    }
    const ext = extFromMime(mimeType);

    // 既存動画を削除
    await blobService.deleteProjectVideo(projectId);

    const arrayBuf = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    await blobService.uploadVideoBuffer(projectId, ext, buffer, mimeType);

    return { status: 201, jsonBody: { message: 'アップロード完了', projectId } };
  } catch (e) {
    return { status: 500, jsonBody: { error: (e as Error).message } };
  }
}

app.http('videos-upload', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'videos/upload',
  handler,
});
