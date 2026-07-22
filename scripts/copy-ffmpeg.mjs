/**
 * @ffmpeg/core (UMD) の core JS/WASM を public/ffmpeg へコピーする。
 *
 * ffmpeg.wasm はブラウザ内で動画を圧縮するために core を実行時ロードする。
 * publicNetworkAccess=Disabled / 社内プロキシ環境で CDN が塞がれても動くよう、
 * core ファイルは同一オリジン (self-host) から配信する。
 *
 * dev では postinstall、prod では build 前に実行される。
 */
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
// ESM ビルドを使う。@ffmpeg/ffmpeg 0.12 は module worker を生成するため、
// worker 内フォールバックの動的 import() が成功する必要があり、UMD ではなく
// ESM (export default) の core でなければ "failed to import ffmpeg-core.js" になる。
const srcDir = resolve(root, 'node_modules/@ffmpeg/core/dist/esm');
const outDir = resolve(root, 'public/ffmpeg');

const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];

if (!existsSync(srcDir)) {
  console.warn('[copy-ffmpeg] @ffmpeg/core not installed; skipping.');
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
for (const f of files) {
  copyFileSync(resolve(srcDir, f), resolve(outDir, f));
  console.log(`[copy-ffmpeg] copied ${f}`);
}
