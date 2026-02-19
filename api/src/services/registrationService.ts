/**
 * 仮登録 (pending registration) 管理サービス
 * Blob Storage の pending-registrations.json に保存する
 * 認証は blobService の共通クライアントを使用
 */
import { randomUUID } from 'crypto';
import type { PendingRegistration } from '../shared/types.js';
import { getPendingRegistrationsJson, putPendingRegistrationsJson } from './blobService.js';

async function loadPending(): Promise<PendingRegistration[]> {
  try {
    const json = await getPendingRegistrationsJson();
    if (!json) return [];
    const all = JSON.parse(json) as PendingRegistration[];
    const now = new Date();
    return all.filter((r) => new Date(r.expiresAt) > now);
  } catch {
    return [];
  }
}

async function savePending(list: PendingRegistration[]): Promise<void> {
  await putPendingRegistrationsJson(JSON.stringify(list, null, 2));
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
