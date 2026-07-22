/**
 * 動画圧縮サービス (ffmpeg.wasm / ブラウザ内)
 *
 * publicNetworkAccess=Disabled + Private Endpoint 環境ではサーバー側での
 * トランスコードが難しく、また SWA linked backend のリクエスト制限
 * (413 / 45秒) を避けるためにも、アップロード前にブラウザ内で圧縮する。
 *
 * 方針:
 *   - 最大解像度 1920x1080、最大 30fps を上限とし、元動画の解像度/フレームレートを
 *     確認して「上限を超える場合のみ」ダウンスケール/フレーム間引きする (変動圧縮)。
 *   - H.264 (libx264) + AAC の MP4 に再エンコードし faststart を付与。
 *   - core (JS/WASM) は同一オリジン (/ffmpeg) から読み込む (CDN 非依存)。
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const FFMPEG_BASE = '/ffmpeg';
const DEFAULT_MAX_WIDTH = 1920;
const DEFAULT_MAX_HEIGHT = 1080;
const DEFAULT_MAX_FPS = 30;

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (!loadPromise) {
    loadPromise = (async () => {
      const ff = new FFmpeg();
      try {
        // 同一オリジンから core を読み込む。@ffmpeg/core は ESM ビルドを使用する
        // (0.12 は module worker を生成するため、worker 内の動的 import() が
        //  成功する ESM (export default) core が必須。UMD だと import に失敗する)。
        const coreURL = await toBlobURL(`${FFMPEG_BASE}/ffmpeg-core.js`, 'text/javascript');
        const wasmURL = await toBlobURL(`${FFMPEG_BASE}/ffmpeg-core.wasm`, 'application/wasm');
        await ff.load({ coreURL, wasmURL });
      } catch (err) {
        // 失敗した Promise をキャッシュしない (次回の圧縮で再試行できるように)
        loadPromise = null;
        // eslint-disable-next-line no-console
        console.error('[videoCompression] ffmpeg load failed:', err);
        throw err;
      }
      ffmpegInstance = ff;
      return ff;
    })();
  }
  return loadPromise;
}

/** ブラウザ内で ffmpeg.wasm が利用可能か (SharedArrayBuffer は単一スレッド core では不要) */
export function isCompressionSupported(): boolean {
  return typeof WebAssembly !== 'undefined' && typeof Worker !== 'undefined';
}

export interface CompressOptions {
  /** 圧縮進捗 (0..1) */
  onProgress?: (fraction: number) => void;
  maxWidth?: number;
  maxHeight?: number;
  maxFps?: number;
}

export interface CompressResult {
  file: File;
  /** 実際に再エンコードしたか (元がそのまま使われた場合 false) */
  compressed: boolean;
  width: number;
  height: number;
}

/** アスペクト比を保ったまま maxW x maxH に収まる偶数寸法を求める */
function fitDimensions(
  w: number,
  h: number,
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  const ratio = Math.min(maxW / w, maxH / h, 1);
  const width = Math.max(2, Math.round((w * ratio) / 2) * 2);
  const height = Math.max(2, Math.round((h * ratio) / 2) * 2);
  return { width, height };
}

/** ffmpeg のログ文字列から入力フレームレートを推定する (取得できなければ null) */
function parseFps(logs: string): number | null {
  const m = logs.match(/(\d+(?:\.\d+)?)\s*fps/);
  if (!m || !m[1]) return null;
  const fps = parseFloat(m[1]);
  return Number.isFinite(fps) && fps > 0 ? fps : null;
}

/**
 * 動画を圧縮する。上限を超えていない場合でも H.264 MP4 に再エンコードして
 * サイズを最適化する。圧縮できない/不要な場合は元ファイルを返す。
 */
export async function compressVideo(
  file: File,
  meta: { width: number; height: number; duration?: number },
  opts: CompressOptions = {},
): Promise<CompressResult> {
  const maxWidth = opts.maxWidth ?? DEFAULT_MAX_WIDTH;
  const maxHeight = opts.maxHeight ?? DEFAULT_MAX_HEIGHT;
  const maxFps = opts.maxFps ?? DEFAULT_MAX_FPS;

  const ff = await getFFmpeg();
  const inputName = 'input';
  const outputName = 'output.mp4';

  try {
    await ff.writeFile(inputName, await fetchFile(file));

    // ── 入力フレームレートをプローブ (ヘッダ読み取りのみ) ─────────
    let probeLogs = '';
    const probeListener = ({ message }: { message: string }) => {
      probeLogs += message + '\n';
    };
    ff.on('log', probeListener);
    try {
      // 出力を指定しない -i はエラー終了するが、その前にストリーム情報が出力される
      await ff.exec(['-i', inputName]);
    } catch {
      // 期待どおりの非ゼロ終了 — 無視
    }
    ff.off('log', probeListener);
    const sourceFps = parseFps(probeLogs);

    // ── フィルタ/引数を決定 (変動圧縮) ───────────────────────
    const needScale = meta.width > maxWidth || meta.height > maxHeight;
    const target = needScale
      ? fitDimensions(meta.width, meta.height, maxWidth, maxHeight)
      : { width: meta.width, height: meta.height };

    const vf: string[] = [];
    if (needScale) {
      vf.push(
        `scale=w=${maxWidth}:h=${maxHeight}:force_original_aspect_ratio=decrease`,
        'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      );
    }

    // フレームレートは元が上限を超える場合のみ間引く (不明な場合は変更しない)
    const fpsArgs =
      sourceFps !== null && sourceFps > maxFps ? ['-r', String(maxFps)] : [];

    // ── 圧縮進捗 ─────────────────────────────────────────
    // ffmpeg.wasm の native `progress` イベントは core の duration 検出に依存して
    // 0 のまま/いきなり 1 になることがあり不安定。既知の duration があるログの
    // `time=HH:MM:SS.xx` を解析して進捗を算出する (こちらが確実)。
    const onProgress = opts.onProgress;
    const duration = meta.duration && meta.duration > 0 ? meta.duration : null;
    const timeRe = /time=\s*(\d+):(\d+):(\d+(?:\.\d+)?)/;

    const nativeProgressListener = ({ progress }: { progress: number }) => {
      // duration 不明時のフォールバック
      if (onProgress && duration === null) {
        onProgress(Math.min(0.99, Math.max(0, progress)));
      }
    };
    const logProgressListener = ({ message }: { message: string }) => {
      if (!onProgress || duration === null) return;
      const m = message.match(timeRe);
      if (!m) return;
      const secs = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
      if (Number.isFinite(secs)) {
        onProgress(Math.min(0.99, Math.max(0, secs / duration)));
      }
    };
    if (onProgress) {
      ff.on('progress', nativeProgressListener);
      ff.on('log', logProgressListener);
    }

    const args = [
      '-i',
      inputName,
      ...(vf.length ? ['-vf', vf.join(',')] : []),
      ...fpsArgs,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '26',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      outputName,
    ];

    const code = await ff.exec(args);
    if (onProgress) {
      ff.off('progress', nativeProgressListener);
      ff.off('log', logProgressListener);
    }
    if (code !== 0) {
      // 圧縮失敗 — 元ファイルにフォールバック
      return { file, compressed: false, width: meta.width, height: meta.height };
    }

    const data = (await ff.readFile(outputName)) as Uint8Array;
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'video';
    // Uint8Array を確実な ArrayBuffer にコピーしてから Blob 化 (型/参照の安全性)
    const bytes = new Uint8Array(data.byteLength);
    bytes.set(data);
    const outFile = new File([bytes], `${baseName}.mp4`, { type: 'video/mp4' });

    // 圧縮結果が元より大きい場合は元を使う (小さい動画で再エンコードが逆効果な場合)
    if (outFile.size >= file.size && !needScale && fpsArgs.length === 0) {
      return { file, compressed: false, width: meta.width, height: meta.height };
    }

    onProgress?.(1);
    return {
      file: outFile,
      compressed: true,
      width: target.width,
      height: target.height,
    };
  } finally {
    // FS クリーンアップ (失敗しても無視)
    try {
      await ff.deleteFile(inputName);
    } catch {
      /* noop */
    }
    try {
      await ff.deleteFile(outputName);
    } catch {
      /* noop */
    }
  }
}
