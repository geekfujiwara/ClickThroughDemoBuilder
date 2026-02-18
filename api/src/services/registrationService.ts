/**
 * 仮登録 (pending registration) 管理サービス
 * Blob Storage の pending-registrations.json に保存する
 */
import { BlobServiceClient } from '@azure/storage-blob';
import { randomUUID } from 'crypto';
import type { PendingRegistration } from '../shared/types.js';

const CONTAINER = 'clickthrough-data';
const BLOB_NAME = 'pending-registrations.json';

async function getContainerClient() {
  const connStr = process.env.STORAGE_CONNECTION_STRING;
  if (!connStr) throw new Error('STORAGE_CONNECTION_STRING is not set');
  const client = BlobServiceClient.fromConnectionString(connStr);
  const container = client.getContainerClient(CONTAINER);
  await container.createIfNotExists();
  return container;
}

async function loadPending(): Promise<PendingRegistration[]> {
  try {
    const container = await getContainerClient();
    const blob = container.getBlockBlobClient(BLOB_NAME);
    if (!(await blob.exists())) return [];
    const buf = await blob.downloadToBuffer();
    const all = JSON.parse(buf.toString()) as PendingRegistration[];
    // 期限切れを除外
    const now = new Date();
    return all.filter((r) => new Date(r.expiresAt) > now);
  } catch {
    return [];
  }
}

async function savePending(list: PendingRegistration[]): Promise<void> {
  const container = await getContainerClient();
  const blob = container.getBlockBlobClient(BLOB_NAME);
  const content = JSON.stringify(list, null, 2);
  await blob.upload(content, Buffer.byteLength(content), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
    conditions: {},
  });
}

/** 仮登録を作成してトークンを返す */
export async function createPendingRegistration(
  input: Omit<PendingRegistration, 'token' | 'createdAt' | 'expiresAt'>,
): Promise<string> {
  const list = await loadPending();
  // 同一 email の既存仮登録を削除（再送信対応）
  const filtered = list.filter((r) => r.email !== input.email);
  const token = randomUUID();
  const now = new Date();
  filtered.push({
    ...input,
    token,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  });
  await savePending(filtered);
  return token;
}

/** トークンを使って仮登録を取得・削除する（一度だけ使用可） */
export async function consumeVerificationToken(
  token: string,
): Promise<PendingRegistration | null> {
  const list = await loadPending();
  const index = list.findIndex((r) => r.token === token);
  if (index < 0) return null;
  const reg = list[index]!;
  if (new Date(reg.expiresAt) < new Date()) return null;
  list.splice(index, 1);
  await savePending(list);
  return reg;
}
