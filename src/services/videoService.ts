/**
 * 動画の保存・読込・サムネイル生成サービス (Azure Blob Storage バックエンド)
 *
 * publicNetworkAccess=Disabled + Private Endpoint 環境ではブラウザが Blob に直接
 * 到達できないため、アップロード/視聴とも必ず API プロキシ経由で行う。
 */
import { apiGet, apiDelete } from './apiClient';
import { generateId } from '@/utils/id';

/** チャンクサイズ (SWA linked backend の 413 / 45秒制限を避けるため小さく分割) */
const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB

/** アップロード API のエラーレスポンスからメッセージを抽出 */
async function extractUploadError(res: Response): Promise<string> {
  let msg = '動画のアップロードに失敗しました';
  if (res.status === 413) {
    msg = 'アップロードサイズが大きすぎます。動画を圧縮してから再試行してください。';
  }
  try {
    const b = (await res.json()) as { error?: string };
    if (b.error) msg = b.error;
  } catch {
    // ignore
  }
  return msg;
}

/** 動画をアップロードし videoId (= projectId) を返す (API 経由バイナリアップロード) */
export async function saveVideo(
  file: File,
  projectId?: string,
  onProgress?: (fraction: number) => void,
): Promise<{ videoId: string; mimeType: string }> {
  const videoId = projectId ?? generateId();
  const base = `projectId=${encodeURIComponent(videoId)}&mimeType=${encodeURIComponent(file.type)}`;

  // ── 小容量: 単発アップロード ─────────────────────────────
  if (file.size <= CHUNK_SIZE) {
    const res = await fetch(`/api/videos/upload?${base}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!res.ok) throw new Error(await extractUploadError(res));
    onProgress?.(1);
    return { videoId, mimeType: file.type };
  }

  // ── 大容量: チャンク分割アップロード (ブロックステージング) ──────
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const blockIds: string[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const chunk = file.slice(start, start + CHUNK_SIZE);
    // ブロックID は全ブロックで同じ長さの base64 文字列である必要がある
    const blockId = btoa(`block-${String(i).padStart(6, '0')}`);
    blockIds.push(blockId);

    const res = await fetch(`/api/videos/upload?${base}&blockId=${encodeURIComponent(blockId)}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: chunk,
    });
    if (!res.ok) throw new Error(await extractUploadError(res));
    // 確定(commit)分を残して進捗を按分
    onProgress?.((i + 1) / (totalChunks + 1));
  }

  // ── ブロックリスト確定 ──────────────────────────────────
  const commitRes = await fetch(`/api/videos/upload?${base}&commit=1`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blockIds }),
  });
  if (!commitRes.ok) throw new Error(await extractUploadError(commitRes));
  onProgress?.(1);

  return { videoId, mimeType: file.type };
}

/** 動画の URL を取得 (API プロキシ URL: /api/videos/{id}/stream) */
export async function getVideoUrl(projectId: string): Promise<string | undefined> {
  try {
    const { url } = await apiGet<{ url: string }>(`/videos/${projectId}`);
    return url;
  } catch {
    return undefined;
  }
}

/**
 * 動画 Blob を取得 — API プロキシ経由でダウンロード
 * PlayerPage など既存コードとの互換性のために維持
 */
export async function getVideoBlob(videoId: string): Promise<Blob | undefined> {
  const url = await getVideoUrl(videoId);
  if (!url) return undefined;
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return undefined;
    return res.blob();
  } catch {
    return undefined;
  }
}

/** 動画を削除 */
export async function deleteVideo(videoId: string): Promise<void> {
  await apiDelete(`/videos/${videoId}`);
}

/**
 * 動画ファイルからメタデータ（duration, width, height）を解析する。
 * <video> 要素を使って非同期にロード。
 */
export function extractVideoMetadata(
  file: File,
): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = () => {
      // duration が Infinity になる場合への対処
      if (!isFinite(video.duration)) {
        video.currentTime = 1e10;
        video.onseeked = () => {
          resolve({
            duration: Math.round(video.duration * 100) / 100,
            width: video.videoWidth,
            height: video.videoHeight,
          });
          URL.revokeObjectURL(url);
        };
      } else {
        resolve({
          duration: Math.round(video.duration * 100) / 100,
          width: video.videoWidth,
          height: video.videoHeight,
        });
        URL.revokeObjectURL(url);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('動画の読み込みに失敗しました。'));
    };
  });
}

/**
 * 動画の先頭フレームからサムネイルを生成 (data:image/jpeg)
 */
export function generateThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadeddata = () => {
      video.currentTime = 0.1; // 少しだけ進めて最初のフレームを取得
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = Math.round((320 / video.videoWidth) * video.videoHeight);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context not available');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('サムネイル生成に失敗しました。'));
    };
  });
}
