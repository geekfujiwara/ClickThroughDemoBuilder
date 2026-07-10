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
import * as projectService from '../services/projectService.js';

const ALLOWED_MIME_TYPES = new Set(['video/mp4', 'video/webm']);
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500 MB

function extFromMime(mime: string): string {
  if (mime === 'video/webm') return 'webm';
  return 'mp4';
}

async function verifyProjectOwner(projectId: string, creatorId: string | undefined): Promise<HttpResponseInit | null> {
  const project = await projectService.getProject(projectId);
  if (project && project.creatorId && project.creatorId !== creatorId) {
    return { status: 403, jsonBody: { error: '他のデザイナーのプロジェクトの動画は操作できません' } };
  }
  return null;
}

async function handler(req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireRole(req, 'designer');
  if ('status' in auth) return auth;

  // ── Binary モード: API 経由で直接アップロード ─────────────
  // publicNetworkAccess=Disabled + Private Endpoint 環境ではブラウザが Blob に直接
  // 到達できないため、SAS 直 PUT は使わず必ず API 経由でアップロードする。
  try {
    const projectId = req.query.get('projectId');
    const mimeType = req.query.get('mimeType') ?? 'video/mp4';
    if (!projectId) {
      return { status: 400, jsonBody: { error: 'projectId クエリパラメータは必須です' } };
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return { status: 400, jsonBody: { error: 'MP4 または WebM 形式のみ許可されます' } };
    }

    // 所有者チェック (IDOR 防止)
    const ownerCheck = await verifyProjectOwner(projectId, auth.payload.creatorId);
    if (ownerCheck) return ownerCheck;

    const ext = extFromMime(mimeType);

    // 既存動画を削除
    await blobService.deleteProjectVideo(projectId);

    const arrayBuf = await req.arrayBuffer();
    if (arrayBuf.byteLength > MAX_VIDEO_SIZE) {
      return { status: 400, jsonBody: { error: 'ファイルサイズは 500MB 以下にしてください' } };
    }
    const buffer = Buffer.from(arrayBuf);
    await blobService.uploadVideoBuffer(projectId, ext, buffer, mimeType);

    return { status: 201, jsonBody: { message: 'アップロード完了', projectId } };
  } catch {
    return { status: 500, jsonBody: { error: '動画アップロードに失敗しました' } };
  }
}

app.http('videos-upload', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'videos/upload',
  handler,
});
