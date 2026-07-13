/**
 * 組織（グループ）のサンプル背景画像を設定するスクリプト
 *
 * 画像が未設定のグループに対して、そのグループのブランドカラー（color）由来の
 * 抽象グラデーション背景（SVG data URL）を生成して設定する。外部依存なし。
 *
 * 使用方法:
 *   cd api
 *   node set-group-images.mjs --from-url https://<swa-host> --preview ./_group-previews  # 公開APIから読んでプレビュー（ストレージ不要）
 *   node set-group-images.mjs --preview ./_group-previews   # 適用せずプレビュー生成（推奨: 事前確認）
 *   node set-group-images.mjs --dry-run                      # 変更内容の確認のみ（書き込みなし）
 *   node set-group-images.mjs                                # 未設定グループにのみ設定
 *   node set-group-images.mjs --force                        # 既存画像も含めて再生成
 *
 * ストレージ接続（set-system-admin.mjs と同じ流儀）:
 *   STORAGE_ACCOUNT_NAME       設定すると Azure AD 認証 (DefaultAzureCredential)
 *   STORAGE_CONNECTION_STRING  接続文字列（キー認証 / Azurite）
 *   ※本番 stclickthroughprod は publicNetworkAccess=Disabled のため、
 *     ストレージへ到達できるネットワーク（Private Endpoint 経由 等）で実行すること。
 */
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const CONTAINER = 'masters';
const BLOB_NAME = 'groups.json';
const OUT_W = 480;
const OUT_H = 270;
const DEFAULT_COLOR = '#1565C0';

// ── 引数 ────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const previewIdx = args.indexOf('--preview');
const PREVIEW_DIR = previewIdx >= 0 ? (args[previewIdx + 1] ?? './_group-previews') : null;
const fromUrlIdx = args.indexOf('--from-url');
const FROM_URL = fromUrlIdx >= 0 ? (args[fromUrlIdx + 1] ?? '').replace(/\/+$/, '') : null;

// ── 色ユーティリティ ─────────────────────────────────────
function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '').trim();
  const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(s || '1565C0', 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex({ r, g, b }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function mix(a, b, t) {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}
const BLACK = { r: 0, g: 0, b: 0 };
const WHITE = { r: 255, g: 255, b: 255 };

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s, l };
}
function hslToRgb({ h, s, l }) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) { const v = l * 255; return { r: v, g: v, b: v }; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: hue(h + 1 / 3) * 255, g: hue(h) * 255, b: hue(h - 1 / 3) * 255 };
}
function hueShift(rgb, deg) {
  const hsl = rgbToHsl(rgb);
  return hslToRgb({ h: hsl.h + deg, s: hsl.s, l: hsl.l });
}

// ── 決定的乱数（id からシード）─────────────────────────────
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 背景 SVG 生成 ────────────────────────────────────────
function generateBackgroundSvg(color, seedKey) {
  const rnd = mulberry32(hashSeed(seedKey || 'seed'));
  const base = hexToRgb(color || DEFAULT_COLOR);
  const baseHsl = rgbToHsl(base);

  // 明るすぎる/暗すぎる場合は中庸に寄せて視認性を確保
  const midL = Math.max(0.30, Math.min(0.62, baseHsl.l));
  const baseAdj = hslToRgb({ h: baseHsl.h, s: Math.max(0.35, baseHsl.s), l: midL });

  const dark = mix(baseAdj, BLACK, 0.45);
  const deep = mix(baseAdj, BLACK, 0.62);
  const light = mix(baseAdj, WHITE, 0.30);
  const accent = hueShift(baseAdj, rnd() > 0.5 ? 28 : -28);
  const accentLight = mix(accent, WHITE, 0.20);

  const angle = Math.round(20 + rnd() * 50); // 20〜70 度
  const rad = (angle * Math.PI) / 180;
  const x2 = (Math.cos(rad) * 100).toFixed(1);
  const y2 = (Math.sin(rad) * 100).toFixed(1);

  // ブロブ（柔らかい光）位置
  const b1x = Math.round(15 + rnd() * 30);
  const b1y = Math.round(15 + rnd() * 30);
  const b2x = Math.round(60 + rnd() * 30);
  const b2y = Math.round(55 + rnd() * 35);
  const b1r = Math.round(120 + rnd() * 80);
  const b2r = Math.round(140 + rnd() * 90);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}" viewBox="0 0 ${OUT_W} ${OUT_H}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="${x2}%" y2="${y2}%">
      <stop offset="0%" stop-color="${rgbToHex(baseAdj)}"/>
      <stop offset="55%" stop-color="${rgbToHex(dark)}"/>
      <stop offset="100%" stop-color="${rgbToHex(deep)}"/>
    </linearGradient>
    <radialGradient id="blob1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${rgbToHex(light)}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${rgbToHex(light)}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="blob2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${rgbToHex(accentLight)}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${rgbToHex(accent)}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="lines" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})">
      <line x1="0" y1="0" x2="0" y2="14" stroke="#ffffff" stroke-opacity="0.05" stroke-width="1"/>
    </pattern>
    <linearGradient id="vign" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.28"/>
    </linearGradient>
  </defs>
  <rect width="${OUT_W}" height="${OUT_H}" fill="url(#bg)"/>
  <circle cx="${(b1x / 100) * OUT_W}" cy="${(b1y / 100) * OUT_H}" r="${b1r}" fill="url(#blob1)"/>
  <circle cx="${(b2x / 100) * OUT_W}" cy="${(b2y / 100) * OUT_H}" r="${b2r}" fill="url(#blob2)"/>
  <rect width="${OUT_W}" height="${OUT_H}" fill="url(#lines)"/>
  <rect width="${OUT_W}" height="${OUT_H}" fill="url(#vign)"/>
</svg>`;

  const base64 = Buffer.from(svg, 'utf-8').toString('base64');
  return { dataUrl: `data:image/svg+xml;base64,${base64}`, svg };
}

// ── ストレージクライアント ───────────────────────────────
function createClient() {
  const storageAccountName = process.env.STORAGE_ACCOUNT_NAME;
  if (storageAccountName) {
    console.log(`Using Azure AD auth for account: ${storageAccountName}`);
    return new BlobServiceClient(
      `https://${storageAccountName}.blob.core.windows.net`,
      new DefaultAzureCredential(),
    );
  }
  let connectionString =
    process.env.STORAGE_CONNECTION_STRING || process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    try {
      const settings = JSON.parse(readFileSync('./local.settings.json', 'utf8'));
      connectionString = settings.Values?.STORAGE_CONNECTION_STRING
        || settings.Values?.AZURE_STORAGE_CONNECTION_STRING
        || settings.Values?.AzureWebJobsStorage;
    } catch { /* ignore */ }
  }
  if (!connectionString) {
    console.error('STORAGE_ACCOUNT_NAME または STORAGE_CONNECTION_STRING を設定してください');
    process.exit(1);
  }
  console.log('Using connection string auth');
  return BlobServiceClient.fromConnectionString(connectionString);
}

function streamToString(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (d) => chunks.push(Buffer.from(d)));
    readable.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    readable.on('error', reject);
  });
}

// ── プレビュー生成（ストレージ不要）──────────────────────
async function runPreview() {
  let groups;
  if (FROM_URL) {
    const res = await fetch(`${FROM_URL}/api/groups`);
    if (!res.ok) throw new Error(`GET ${FROM_URL}/api/groups -> ${res.status}`);
    groups = await res.json();
  } else {
    const client = createClient();
    const container = client.getContainerClient(CONTAINER);
    const blobRef = container.getBlockBlobClient(BLOB_NAME);
    const download = await blobRef.download(0);
    const data = JSON.parse(await streamToString(download.readableStreamBody));
    groups = data.groups || [];
  }

  mkdirSync(PREVIEW_DIR, { recursive: true });
  const cards = [];
  for (const g of groups) {
    const { dataUrl, svg } = generateBackgroundSvg(g.color, g.id || g.name);
    const safe = String(g.name).replace(/[^\w.-]+/g, '_');
    writeFileSync(`${PREVIEW_DIR}/${safe}.svg`, svg, 'utf-8');
    const has = g.imageDataUrl ? '（既存あり）' : '（未設定→提案）';
    cards.push(`<figure><img src="${dataUrl}" width="240" height="135"/><figcaption>${g.name} ${has}<br><small>${g.color || ''}</small></figcaption></figure>`);
  }
  const html = `<!doctype html><meta charset="utf-8"><title>Group background preview</title>
<style>body{font-family:Segoe UI,system-ui,sans-serif;background:#faf9f8;padding:24px}
h1{font-size:18px}section{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
figure{margin:0;background:#fff;border:1px solid #e1dfdd;border-radius:8px;overflow:hidden}
figure img{display:block;width:100%;height:auto}figcaption{padding:8px 10px;font-size:13px}</style>
<h1>組織背景プレビュー（${groups.length} 件）</h1><section>${cards.join('\n')}</section>`;
  writeFileSync(`${PREVIEW_DIR}/index.html`, html, 'utf-8');
  console.log(`プレビューを生成しました: ${PREVIEW_DIR}/index.html`);
}

// ── 適用 ────────────────────────────────────────────────
async function runApply() {
  const client = createClient();
  const container = client.getContainerClient(CONTAINER);
  await container.createIfNotExists();
  const blobRef = container.getBlockBlobClient(BLOB_NAME);

  const download = await blobRef.download(0);
  const data = JSON.parse(await streamToString(download.readableStreamBody));
  const groups = data.groups || [];

  let changed = 0;
  for (const g of groups) {
    const hasImage = typeof g.imageDataUrl === 'string' && g.imageDataUrl.length > 0;
    if (hasImage && !FORCE) {
      console.log(`skip : ${g.name}（既に画像あり）`);
      continue;
    }
    const { dataUrl } = generateBackgroundSvg(g.color, g.id || g.name);
    g.imageDataUrl = dataUrl;
    g.updatedAt = new Date().toISOString();
    changed++;
    console.log(`set  : ${g.name}（color=${g.color || DEFAULT_COLOR}, ${dataUrl.length} bytes）`);
  }

  if (changed === 0) {
    console.log('変更対象はありませんでした。');
    return;
  }
  if (DRY_RUN) {
    console.log(`\n[dry-run] ${changed} 件を設定予定（書き込みは行っていません）。`);
    return;
  }
  const out = JSON.stringify(data);
  await blobRef.upload(out, Buffer.byteLength(out, 'utf-8'), {
    blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
  });
  console.log(`\n完了: ${changed} 件のグループに背景画像を設定しました。`);
}

async function main() {
  if (PREVIEW_DIR) {
    await runPreview();
  } else {
    await runApply();
  }
}

main().catch((e) => { console.error('エラー:', e.message); process.exit(1); });
