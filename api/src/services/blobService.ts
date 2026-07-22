/**
 * Blob Storage 操作サービス
 *
 * containers:
 *   - projects  : {projectId}.json
 *   - videos    : {projectId}/video.{ext}
 */
import {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
  ContainerClient,
  type BlobSASSignatureValues,
} from '@azure/storage-blob';
import { ClientSecretCredential, ManagedIdentityCredential } from '@azure/identity';

const connectionString = process.env.STORAGE_CONNECTION_STRING ?? 'UseDevelopmentStorage=true';
const storageAccountName = process.env.STORAGE_ACCOUNT_NAME;

/**
 * Azure 本番環境で動作しているかどうかを判定する。
 * WEBSITE_SITE_NAME は Azure App Service / Functions が自動的に設定する環境変数。
 */
function isAzureEnvironment(): boolean {
  return !!(process.env.WEBSITE_SITE_NAME ?? process.env.AZURE_FUNCTIONS_ENVIRONMENT);
}

let _client: BlobServiceClient | null = null;

/**
 * Blob Storage 専用の認証クレデンシャルを返す。
 *
 * AZURE_CLIENT_ID / AZURE_CLIENT_SECRET / AZURE_TENANT_ID が全て設定されている場合は
 * ClientSecretCredential (サービスプリンシパル) を使用。
 * そのサービスプリンシパルには Storage Blob Data Contributor RBAC を付与済み。
 *
 * それ以外の場合は ManagedIdentityCredential を使用。
 * (SWA System Assigned Identity: principalId eeb9cb3a にも RBAC 付与済み)
 *
 * allowSharedKeyAccess=false / publicNetworkAccess=Disabled の環境でも、
 * networkAcls.bypass=AzureServices 経由でアクセス可能。
 */
function getCredential(): ClientSecretCredential | ManagedIdentityCredential {
  const clientId     = process.env.AZURE_CLIENT_ID?.trim();
  const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim();
  const tenantId     = process.env.AZURE_TENANT_ID?.trim();
  if (clientId && clientSecret && tenantId) {
    return new ClientSecretCredential(tenantId, clientId, clientSecret);
  }
  // ローカル開発または AZURE_CLIENT_* 未設定時: SWA System Assigned MI を使用
  return new ManagedIdentityCredential();
}

function getClient(): BlobServiceClient {
  if (!_client) {
    if (storageAccountName) {
      // STORAGE_ACCOUNT_NAME 設定あり → ChainedTokenCredential (MI → AzureCLI) を使用
      // allowSharedKeyAccess=false / publicNetworkAccess=Disabled でも動作
      _client = new BlobServiceClient(
        `https://${storageAccountName}.blob.core.windows.net`,
        getCredential(),
      );
    } else if (isAzureEnvironment()) {
      // Azure 環境なのに STORAGE_ACCOUNT_NAME が未設定 → 明確なエラーで失敗させる
      // (接続文字列フォールバックは allowSharedKeyAccess=false で 403 になるため使用しない)
      throw new Error(
        'STORAGE_ACCOUNT_NAME が設定されていません。' +
        'Azure Functions のアプリ設定に STORAGE_ACCOUNT_NAME を追加してください。' +
        'セットアップ手順: docs/setup-azure-identity.ps1 を参照。',
      );
    } else {
      // ローカル開発: Azurite または az login 済みの実ストレージ
      _client = BlobServiceClient.fromConnectionString(connectionString);
    }
  }
  return _client;
}

function container(name: string): ContainerClient {
  return getClient().getContainerClient(name);
}

// ── コンテナ初期化 (存在しなければ作成) ─────────────────────

const initialized = new Set<string>();

async function ensureContainer(name: string): Promise<ContainerClient> {
  const c = container(name);
  if (!initialized.has(name)) {
    await c.createIfNotExists();
    initialized.add(name);
  }
  return c;
}

// ── Projects JSON ───────────────────────────────────────────

export async function getProjectJson(projectId: string): Promise<string | null> {
  const c = await ensureContainer('projects');
  const blob = c.getBlockBlobClient(`${projectId}.json`);
  try {
    const buf = await blob.downloadToBuffer();
    return buf.toString('utf-8');
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode === 404) return null;
    throw e;
  }
}

export async function putProjectJson(projectId: string, json: string): Promise<void> {
  const c = await ensureContainer('projects');
  const blob = c.getBlockBlobClient(`${projectId}.json`);
  await blob.upload(json, Buffer.byteLength(json, 'utf-8'), {
    blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
  });
}

export async function deleteProjectBlob(projectId: string): Promise<void> {
  const c = await ensureContainer('projects');
  await c.getBlockBlobClient(`${projectId}.json`).deleteIfExists();
}

export async function listProjectIds(): Promise<string[]> {
  const c = await ensureContainer('projects');
  const ids: string[] = [];
  for await (const item of c.listBlobsFlat()) {
    if (item.name.endsWith('.json')) {
      ids.push(item.name.replace('.json', ''));
    }
  }
  return ids;
}

// ── Group Masters JSON ─────────────────────────────────────

export async function getGroupMasterJson(): Promise<string | null> {
  const c = await ensureContainer('masters');
  const blob = c.getBlockBlobClient('groups.json');
  try {
    const buf = await blob.downloadToBuffer();
    return buf.toString('utf-8');
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode === 404) return null;
    throw e;
  }
}

export async function putGroupMasterJson(json: string): Promise<void> {
  const c = await ensureContainer('masters');
  const blob = c.getBlockBlobClient('groups.json');
  await blob.upload(json, Buffer.byteLength(json, 'utf-8'), {
    blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
  });
}

export async function getCreatorMasterJson(): Promise<string | null> {
  const c = await ensureContainer('masters');
  const blob = c.getBlockBlobClient('creators.json');
  try {
    const buf = await blob.downloadToBuffer();
    return buf.toString('utf-8');
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode === 404) return null;
    throw e;
  }
}

export async function putCreatorMasterJson(json: string): Promise<void> {
  const c = await ensureContainer('masters');
  const blob = c.getBlockBlobClient('creators.json');
  await blob.upload(json, Buffer.byteLength(json, 'utf-8'), {
    blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
  });
}

export async function getTrustedAliasesJson(): Promise<string | null> {
  const c = await ensureContainer('masters');
  const blob = c.getBlockBlobClient('trusted-aliases.json');
  try {
    const buf = await blob.downloadToBuffer();
    return buf.toString('utf-8');
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode === 404) return null;
    throw e;
  }
}

export async function putTrustedAliasesJson(json: string): Promise<void> {
  const c = await ensureContainer('masters');
  const blob = c.getBlockBlobClient('trusted-aliases.json');
  await blob.upload(json, Buffer.byteLength(json, 'utf-8'), {
    blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
  });
}

// ── Pinned Demos JSON ──────────────────────────────────────

export async function getPinnedDemosJson(): Promise<string | null> {
  const c = await ensureContainer('masters');
  const blob = c.getBlockBlobClient('pinned-demos.json');
  try {
    const buf = await blob.downloadToBuffer();
    return buf.toString('utf-8');
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode === 404) return null;
    throw e;
  }
}

export async function putPinnedDemosJson(json: string): Promise<void> {
  const c = await ensureContainer('masters');
  const blob = c.getBlockBlobClient('pinned-demos.json');
  await blob.upload(json, Buffer.byteLength(json, 'utf-8'), {
    blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
  });
}

export async function putUsageLogJson(path: string, json: string): Promise<void> {
  const c = await ensureContainer('usage-logs');
  const blob = c.getBlockBlobClient(path);
  await blob.upload(json, Buffer.byteLength(json, 'utf-8'), {
    blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
  });
}

// ── Pending Registrations ──────────────────────────────────

export async function getPendingRegistrationsJson(): Promise<string | null> {
  const c = await ensureContainer('clickthrough-data');
  const blob = c.getBlockBlobClient('pending-registrations.json');
  try {
    const buf = await blob.downloadToBuffer();
    return buf.toString('utf-8');
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode === 404) return null;
    throw e;
  }
}

export async function putPendingRegistrationsJson(json: string): Promise<void> {
  const c = await ensureContainer('clickthrough-data');
  const blob = c.getBlockBlobClient('pending-registrations.json');
  await blob.upload(json, Buffer.byteLength(json, 'utf-8'), {
    blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
  });
}

// ── Videos ──────────────────────────────────────────────────

function videoBlobName(projectId: string, ext: string): string {
  return `${projectId}/video.${ext}`;
}

/**
 * 動画の読み取り用 SAS URL を生成 (有効期限: 1時間)
 */
export async function getVideoSasUrl(projectId: string): Promise<string | null> {
  const c = await ensureContainer('videos');

  // 拡張子を探す
  let blobName: string | null = null;
  for await (const item of c.listBlobsFlat({ prefix: `${projectId}/` })) {
    blobName = item.name;
    break;
  }
  if (!blobName) return null;

  const blobClient = c.getBlockBlobClient(blobName);

  // Connection-string ベースで SAS 生成
  if (storageAccountName) {
    const startsOn = new Date(Date.now() - 5 * 60 * 1000);
    const expiresOn = new Date(Date.now() + 60 * 60 * 1000);
    const userDelegationKey = await getClient().getUserDelegationKey(startsOn, expiresOn);
    const sasValues: BlobSASSignatureValues = {
      containerName: 'videos',
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    };
    const sasToken = generateBlobSASQueryParameters(
      sasValues,
      userDelegationKey,
      storageAccountName,
    ).toString();
    return `${blobClient.url}?${sasToken}`;
  }

  // ローカル開発 (Azurite) — SAS は不要。URL をそのまま返す。
  // ※ SharedKey 認証 (StorageSharedKeyCredential) は allowSharedKeyAccess=false のポリシーで
  //    403 になるため、接続文字列からのキー抽出は使用しない。
  return blobClient.url;
}

/**
 * 動画アップロード用 SAS URL を生成 (有効期限: 30分)
 */
export async function getVideoUploadSasUrl(
  projectId: string,
  ext: string,
): Promise<{ uploadUrl: string; blobName: string }> {
  const c = await ensureContainer('videos');
  const name = videoBlobName(projectId, ext);
  const blobClient = c.getBlockBlobClient(name);

  if (storageAccountName) {
    const startsOn = new Date(Date.now() - 5 * 60 * 1000);
    const expiresOn = new Date(Date.now() + 30 * 60 * 1000);
    const userDelegationKey = await getClient().getUserDelegationKey(startsOn, expiresOn);
    const sasValues: BlobSASSignatureValues = {
      containerName: 'videos',
      blobName: name,
      permissions: BlobSASPermissions.parse('rcw'),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https,
    };
    const sasToken = generateBlobSASQueryParameters(
      sasValues,
      userDelegationKey,
      storageAccountName,
    ).toString();
    return { uploadUrl: `${blobClient.url}?${sasToken}`, blobName: name };
  }

  // ローカル開発 (Azurite) — SAS は不要。URL をそのまま返す。
  // ※ SharedKey 認証 (StorageSharedKeyCredential) は allowSharedKeyAccess=false のポリシーで
  //    403 になるため、接続文字列からのキー抽出は使用しない。
  return { uploadUrl: blobClient.url, blobName: name };
}

/**
 * 動画を API 経由で直接アップロード (小さいファイル向けフォールバック)
 */
export async function uploadVideoBuffer(
  projectId: string,
  ext: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  const c = await ensureContainer('videos');
  const name = videoBlobName(projectId, ext);
  const blob = c.getBlockBlobClient(name);
  await blob.upload(buffer, buffer.length, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
}

/**
 * チャンクアップロード: 1ブロックをステージングする。
 *
 * SWA linked backend / リバースプロキシは 1 リクエストのボディサイズ (413) と
 * 実行時間 (45秒) に制限があるため、大容量動画は小さいブロックに分割して送る。
 * 全ブロックを stageBlock した後、commitVideoBlocks でまとめて確定する。
 */
export async function stageVideoBlock(
  projectId: string,
  ext: string,
  blockId: string,
  buffer: Buffer,
): Promise<void> {
  const c = await ensureContainer('videos');
  const name = videoBlobName(projectId, ext);
  const blob = c.getBlockBlobClient(name);
  await blob.stageBlock(blockId, buffer, buffer.length);
}

/**
 * チャンクアップロード: ステージ済みブロックを順序どおりに確定する。
 */
export async function commitVideoBlocks(
  projectId: string,
  ext: string,
  blockIds: string[],
  contentType: string,
): Promise<void> {
  const c = await ensureContainer('videos');
  const name = videoBlobName(projectId, ext);
  const blob = c.getBlockBlobClient(name);
  await blob.commitBlockList(blockIds, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
}

/**
 * 動画を API プロキシ経由でストリーム配信するための取得。
 * Private Endpoint 環境 (publicNetworkAccess=Disabled) ではブラウザが Blob に直接
 * 到達できないため、Function App が Managed Identity で Blob を読み取りブラウザへ中継する。
 * HTTP Range に対応 (シーク・大容量動画のため)。
 *
 * @param range 省略時は全体を返す。指定時は [start, end] (両端含む) の部分範囲。
 * @returns 動画が存在しない場合は null。
 */
export interface VideoStreamResult {
  stream: NodeJS.ReadableStream;
  contentType: string;
  /** このレスポンスで返すバイト数 (範囲指定時は範囲長) */
  contentLength: number;
  /** Blob 全体のサイズ */
  totalSize: number;
  start: number;
  end: number;
}

export async function getVideoStream(
  projectId: string,
  range?: { start: number; end?: number },
): Promise<VideoStreamResult | null> {
  const c = await ensureContainer('videos');

  // 拡張子を探す (最初の1件)
  let blobName: string | null = null;
  for await (const item of c.listBlobsFlat({ prefix: `${projectId}/` })) {
    blobName = item.name;
    break;
  }
  if (!blobName) return null;

  const blob = c.getBlockBlobClient(blobName);
  const props = await blob.getProperties();
  const totalSize = props.contentLength ?? 0;
  const contentType = props.contentType ?? 'video/mp4';

  let start = 0;
  let end = totalSize > 0 ? totalSize - 1 : 0;
  if (range) {
    start = Math.max(0, range.start);
    end = range.end !== undefined ? Math.min(range.end, totalSize - 1) : totalSize - 1;
    if (start > end) start = end;
  }
  const count = totalSize === 0 ? 0 : end - start + 1;

  const resp = await blob.download(start, count);
  const stream = resp.readableStreamBody;
  if (!stream) return null;

  return { stream, contentType, contentLength: count, totalSize, start, end };
}

/** 動画が存在するか (ダウンロードせず存在のみ確認) */
export async function videoExists(projectId: string): Promise<boolean> {
  const c = await ensureContainer('videos');
  for await (const _item of c.listBlobsFlat({ prefix: `${projectId}/` })) {
    return true;
  }
  return false;
}

/**
 * プロジェクトに紐づく動画を削除
 */
export async function deleteProjectVideo(projectId: string): Promise<void> {
  const c = await ensureContainer('videos');
  for await (const item of c.listBlobsFlat({ prefix: `${projectId}/` })) {
    await c.getBlockBlobClient(item.name).deleteIfExists();
  }
}

// ── Social Data (Likes / Favorites / Comments / Feed) ───────

async function getSocialJson(name: string): Promise<string | null> {
  const c = await ensureContainer('masters');
  const blob = c.getBlockBlobClient(name);
  try {
    const buf = await blob.downloadToBuffer();
    return buf.toString('utf-8');
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode === 404) return null;
    throw e;
  }
}

async function putSocialJson(name: string, json: string): Promise<void> {
  const c = await ensureContainer('masters');
  const blob = c.getBlockBlobClient(name);
  await blob.upload(json, Buffer.byteLength(json, 'utf-8'), {
    blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
  });
}

export const getLikesJson     = () => getSocialJson('likes.json');
export const putLikesJson     = (j: string) => putSocialJson('likes.json', j);
export const getFavoritesJson = () => getSocialJson('favorites.json');
export const putFavoritesJson = (j: string) => putSocialJson('favorites.json', j);
export const getCommentsJson  = () => getSocialJson('comments.json');
export const putCommentsJson  = (j: string) => putSocialJson('comments.json', j);
export const getFeedJson      = () => getSocialJson('feed.json');
export const putFeedJson      = (j: string) => putSocialJson('feed.json', j);
export const getProfileCommentsJson = () => getSocialJson('profile-comments.json');
export const putProfileCommentsJson = (j: string) => putSocialJson('profile-comments.json', j);

// ── Usage Logs ────────────────────────────────────────────────

export interface RawUsageLog {
  id: string;
  timestamp: string;
  event: 'view_start' | 'view_complete';
  demoId: string;
  demoName: string;
  demoGroupId?: string;
  demoGroupName: string;
  // ビューワー情報（v2 以降で付加）
  viewerCreatorId?: string;
  viewerCreatorName?: string;
  viewerGroupId?: string;
  viewerGroupName?: string;
  role: string;
  ip: string;
  site: string;
  userAgent: string;
}

/**
 * 指定した日付プレフィックス一覧に対応する使用ログを取得 (最大 2000 件)
 */
// ── Share Tokens ──────────────────────────────────────────────

export async function getShareTokensJson(): Promise<string | null> {
  const c = await ensureContainer('masters');
  const blob = c.getBlockBlobClient('share-tokens.json');
  try {
    const buf = await blob.downloadToBuffer();
    return buf.toString('utf-8');
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode === 404) return null;
    throw e;
  }
}

export async function putShareTokensJson(json: string): Promise<void> {
  const c = await ensureContainer('masters');
  const blob = c.getBlockBlobClient('share-tokens.json');
  await blob.upload(json, Buffer.byteLength(json, 'utf-8'), {
    blobHTTPHeaders: { blobContentType: 'application/json; charset=utf-8' },
  });
}

// ── Usage Logs ────────────────────────────────────────────────

export async function getUsageLogsForDays(datePrefixes: string[]): Promise<RawUsageLog[]> {
  const c = await ensureContainer('usage-logs');
  const results: RawUsageLog[] = [];
  const MAX = 2000;

  for (const prefix of datePrefixes) {
    if (results.length >= MAX) break;
    for await (const item of c.listBlobsFlat({ prefix: `${prefix}/` })) {
      if (results.length >= MAX) break;
      try {
        const blob = c.getBlockBlobClient(item.name);
        const buf = await blob.downloadToBuffer();
        const log = JSON.parse(buf.toString('utf-8')) as RawUsageLog;
        results.push(log);
      } catch {
        // 壊れたログは無視
      }
    }
  }
  return results;
}
