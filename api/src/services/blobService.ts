/**
 * Blob Storage 操作サービス
 *
 * containers:
 *   - projects  : {projectId}.json
 *   - videos    : {projectId}/video.{ext}
 */
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
  ContainerClient,
  type BlobSASSignatureValues,
} from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

const connectionString = process.env.STORAGE_CONNECTION_STRING ?? 'UseDevelopmentStorage=true';
const storageAccountName = process.env.STORAGE_ACCOUNT_NAME;

/** 実際の接続文字列（AccountKey 付き）かどうかを判定 */
function isRealConnectionString(cs: string): boolean {
  return cs.includes('AccountKey=') && !cs.includes('UseDevelopmentStorage');
}

let _client: BlobServiceClient | null = null;

function getClient(): BlobServiceClient {
  if (!_client) {
    if (isRealConnectionString(connectionString)) {
      // 接続文字列（AccountKey）が設定されている場合は最優先で使用
      _client = BlobServiceClient.fromConnectionString(connectionString);
    } else if (storageAccountName) {
      // 接続文字列がない場合のみ DefaultAzureCredential（マネージド ID）を使用
      _client = new BlobServiceClient(
        `https://${storageAccountName}.blob.core.windows.net`,
        new DefaultAzureCredential(),
      );
    } else {
      // ローカル開発: Azurite
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

  const parsedConn = parseConnectionString(connectionString);
  if (parsedConn.accountName && parsedConn.accountKey) {
    const cred = new StorageSharedKeyCredential(parsedConn.accountName, parsedConn.accountKey);
    const sasValues: BlobSASSignatureValues = {
      containerName: 'videos',
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      startsOn: new Date(),
      expiresOn: new Date(Date.now() + 60 * 60 * 1000), // 1h
    };
    const sasToken = generateBlobSASQueryParameters(sasValues, cred).toString();
    return `${blobClient.url}?${sasToken}`;
  }

  // Azurite (development storage) — SAS は不要
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

  const parsedConn = parseConnectionString(connectionString);
  if (parsedConn.accountName && parsedConn.accountKey) {
    const cred = new StorageSharedKeyCredential(parsedConn.accountName, parsedConn.accountKey);
    const sasValues: BlobSASSignatureValues = {
      containerName: 'videos',
      blobName: name,
      permissions: BlobSASPermissions.parse('rcw'), // read, create, write
      startsOn: new Date(),
      expiresOn: new Date(Date.now() + 30 * 60 * 1000), // 30min
    };
    const sasToken = generateBlobSASQueryParameters(sasValues, cred).toString();
    return { uploadUrl: `${blobClient.url}?${sasToken}`, blobName: name };
  }

  // Azurite — URL をそのまま返す
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
 * プロジェクトに紐づく動画を削除
 */
export async function deleteProjectVideo(projectId: string): Promise<void> {
  const c = await ensureContainer('videos');
  for await (const item of c.listBlobsFlat({ prefix: `${projectId}/` })) {
    await c.getBlockBlobClient(item.name).deleteIfExists();
  }
}

// ── Helpers ─────────────────────────────────────────────────

function parseConnectionString(cs: string): { accountName?: string; accountKey?: string } {
  const parts = new Map<string, string>();
  for (const part of cs.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      parts.set(part.substring(0, idx), part.substring(idx + 1));
    }
  }
  return {
    accountName: parts.get('AccountName'),
    accountKey: parts.get('AccountKey'),
  };
}
