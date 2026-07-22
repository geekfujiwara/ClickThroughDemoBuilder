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
const MAX_BLOCK_SIZE = 8 * 1024 * 1024; // 8 MB (クライアントのチャンクサイズ上限 + 余裕)

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
  //
  // SWA linked backend / リバースプロキシは 1 リクエストのボディサイズ (413) と
  // 実行時間 (45秒) に制限があるため、大容量ファイルは複数の小さなチャンクに分割し
  // ブロック単位でステージング → 最後にまとめて確定 (commit) する。
  //   - stage:  ?projectId=..&mimeType=..&blockId=.. (body = チャンク bytes)
  //   - commit: ?projectId=..&mimeType=..&commit=1  (body = JSON string[] of blockIds)
  //   - 単発:   ?projectId=..&mimeType=..           (body = ファイル全体; 小容量向け)
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
    const blockId = req.query.get('blockId');
    const isCommit = req.query.get('commit') === '1';

    // ── ブロックステージング (チャンク) ─────────────────
    if (blockId) {
      const arrayBuf = await req.arrayBuffer();
      if (arrayBuf.byteLength > MAX_BLOCK_SIZE) {
        return { status: 400, jsonBody: { error: 'チャンクサイズが大きすぎます' } };
      }
      await blobService.stageVideoBlock(projectId, ext, blockId, Buffer.from(arrayBuf));
      return { status: 202, jsonBody: { message: 'ブロック受信', blockId } };
    }

    // ── ブロックリスト確定 (チャンクアップロード完了) ───────
    if (isCommit) {
      let blockIds: string[];
      try {
        const body = (await req.json()) as { blockIds?: unknown };
        blockIds = Array.isArray(body.blockIds) ? (body.blockIds as string[]) : [];
      } catch {
        return { status: 400, jsonBody: { error: 'blockIds が不正です' } };
      }
      if (blockIds.length === 0) {
        return { status: 400, jsonBody: { error: 'blockIds が空です' } };
      }
      if (blockIds.length * MAX_BLOCK_SIZE > MAX_VIDEO_SIZE) {
        return { status: 400, jsonBody: { error: 'ファイルサイズは 500MB 以下にしてください' } };
      }
      await blobService.commitVideoBlocks(projectId, ext, blockIds, mimeType);
      return { status: 201, jsonBody: { message: 'アップロード完了', projectId } };
    }

    // ── 単発アップロード (小容量フォールバック) ────────────
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
