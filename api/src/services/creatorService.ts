/**
 * 作成者マスター管理サービス
 */
import crypto from 'node:crypto';
import type { DemoCreator, DemoCreatorRecord } from '../shared/types.js';
import * as blob from './blobService.js';
import * as projectService from './projectService.js';

interface CreatorMasterData {
  version: number;
  creators: DemoCreatorRecord[];
}

const EMPTY_DATA: CreatorMasterData = { version: 1, creators: [] };

/**
 * scrypt でパスワードをハッシュ化する（ランダムソルト付き）
 * 出力形式: "scrypt:<16-byte-hex-salt>:<32-byte-hex-hash>"
 * 後方互換: 旧 SHA-256 ハッシュ（64 hex 文字、プレフィックスなし）も verifyPasswordHash で検証可能
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (crypto.scryptSync(password, salt, 32) as Buffer).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

/**
 * ハッシュとパスワードの一致を定数時間で検証する
 * 旧 SHA-256 形式（プレフィックスなし）にも対応する
 */
export function verifyPasswordHash(storedHash: string, candidate: string): boolean {
  try {
    if (storedHash.startsWith('scrypt:')) {
      const parts = storedHash.split(':');
      const salt = parts[1];
      const hash = parts[2];
      if (!salt || !hash) return false;
      const candidateBuf = crypto.scryptSync(candidate, salt, 32) as Buffer;
      const storedBuf = Buffer.from(hash, 'hex');
      if (candidateBuf.length !== storedBuf.length) return false;
      return crypto.timingSafeEqual(candidateBuf, storedBuf);
    }
    // 後方互換: 旧 SHA-256 ハッシュ（移行期間用）
    const candidateSha = Buffer.from(
      crypto.createHash('sha256').update(candidate).digest('hex'),
    );
    const storedSha = Buffer.from(storedHash);
    if (candidateSha.length !== storedSha.length) return false;
    return crypto.timingSafeEqual(candidateSha, storedSha);
  } catch {
    return false;
  }
}

function generateRandomPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(length))
    .map((b) => chars[b % chars.length])
    .join('');
}

function validateEmail(email: string): void {
  const lower = email.toLowerCase().trim();
  if (!lower) return;
  if (!lower.endsWith('@microsoft.com')) {
    throw new Error('Email must be a @microsoft.com address.');
  }
  if (!/^[^@\s]+@microsoft\.com$/.test(lower)) {
    throw new Error('Invalid email format.');
  }
}

function toResponse(r: DemoCreatorRecord): DemoCreator {
  return {
    id: r.id,
    name: r.name,
    groupId: r.groupId,
    language: r.language,
    email: r.email,
    hasPassword: !!r.passwordHash,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

async function loadMaster(): Promise<CreatorMasterData> {
  const json = await blob.getCreatorMasterJson();
  if (!json) return { ...EMPTY_DATA };
  try {
    const data = JSON.parse(json) as Partial<CreatorMasterData>;
    const creators = Array.isArray(data.creators)
      ? data.creators.map((raw): DemoCreatorRecord => ({
          id: raw.id,
          name: raw.name,
          groupId: raw.groupId,
          language: (raw.language === 'en' ? 'en' : 'ja') as 'ja' | 'en',
          email: raw.email,
          passwordHash: raw.passwordHash,
          createdAt: raw.createdAt,
          updatedAt: raw.updatedAt,
        }))
      : [];
    return { version: 1, creators };
  } catch {
    return { ...EMPTY_DATA };
  }
}

async function saveMaster(data: CreatorMasterData): Promise<void> {
  await blob.putCreatorMasterJson(JSON.stringify(data));
}

export async function getAllCreators(): Promise<DemoCreator[]> {
  const data = await loadMaster();
  return [...data.creators]
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    .map(toResponse);
}

export async function createCreator(input: {
  name: string;
  groupId?: string;
  language: 'ja' | 'en';
  email?: string;
  password?: string;
}): Promise<DemoCreator> {
  const { name, groupId, language, email, password } = input;
  const trimmed = name.trim();
  if (!trimmed) throw new Error('作成者名は必須です');
  if (email) validateEmail(email);

  const data = await loadMaster();
  if (data.creators.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error('同名の作成者がすでに存在します');
  }

  const now = new Date().toISOString();
  const record: DemoCreatorRecord = {
    id: crypto.randomUUID(),
    name: trimmed,
    groupId,
    language,
    email: email?.toLowerCase().trim() || undefined,
    passwordHash: password ? hashPassword(password) : undefined,
    createdAt: now,
    updatedAt: now,
  };

  data.creators.push(record);
  await saveMaster(data);
  return toResponse(record);
}

export async function updateCreator(
  creatorId: string,
  input: { name: string; groupId?: string; language: 'ja' | 'en'; email?: string; password?: string; currentPassword?: string; clearPassword?: boolean },
): Promise<DemoCreator> {
  const { name, groupId, language, email, password, currentPassword, clearPassword } = input;
  const trimmed = name.trim();
  if (!trimmed) throw new Error('作成者名は必須です');
  if (email) validateEmail(email);

  const data = await loadMaster();
  const index = data.creators.findIndex((c) => c.id === creatorId);
  if (index < 0) throw new Error('作成者が見つかりません');

  // 現在のパスワードが指定された場合は検証する
  if (currentPassword !== undefined) {
    const existing0 = data.creators[index]!;
    if (existing0.passwordHash && !verifyPasswordHash(existing0.passwordHash, currentPassword)) {
      throw new Error('現在のパスワードが正しくありません');
    }
  }

  if (data.creators.some((c) => c.id !== creatorId && c.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error('同名の作成者がすでに存在します');
  }

  const existing = data.creators[index]!;
  const updated: DemoCreatorRecord = {
    ...existing,
    name: trimmed,
    groupId,
    language,
    email: email !== undefined ? (email.toLowerCase().trim() || undefined) : existing.email,
    passwordHash: clearPassword ? undefined : password ? hashPassword(password) : existing.passwordHash,
    updatedAt: new Date().toISOString(),
  };
  data.creators[index] = updated;
  await saveMaster(data);
  return toResponse(updated);
}

/** パスワードをランダム英数字にリセットし、新パスワードを返す */
export async function resetCreatorPassword(creatorId: string): Promise<{ newPassword: string; creator: DemoCreator }> {
  const data = await loadMaster();
  const index = data.creators.findIndex((c) => c.id === creatorId);
  if (index < 0) throw new Error('作成者が見つかりません');

  const newPassword = generateRandomPassword(10);
  const existing = data.creators[index]!;
  const updated: DemoCreatorRecord = {
    ...existing,
    passwordHash: hashPassword(newPassword),
    updatedAt: new Date().toISOString(),
  };
  data.creators[index] = updated;
  await saveMaster(data);
  return { newPassword, creator: toResponse(updated) };
}

export async function verifyCreatorPassword(creatorId: string, password: string): Promise<boolean> {
  const data = await loadMaster();
  const record = data.creators.find((c) => c.id === creatorId);
  if (!record) return false;
  if (!record.passwordHash) return false; // パスワード未設定はログイン不可（S-02 修正）
  return verifyPasswordHash(record.passwordHash, password);
}

/** email でクリエイターを検索（email login 用）。見つからなければ null */
export async function findCreatorByEmail(email: string): Promise<DemoCreator | null> {
  const data = await loadMaster();
  const lower = email.toLowerCase().trim();
  const record = data.creators.find((c) => c.email?.toLowerCase() === lower);
  return record ? toResponse(record) : null;
}

/** ID とパスワードで厳密に検証（パスワード未設定の場合は false を返す） */
export async function verifyCreatorPasswordById(creatorId: string, password: string): Promise<boolean> {
  const data = await loadMaster();
  const record = data.creators.find((c) => c.id === creatorId);
  if (!record || !record.passwordHash) return false; // パスワード未設定はログイン不可
  return verifyPasswordHash(record.passwordHash, password);
}

/** ID でクリエイターを取得 */
export async function getCreatorById(creatorId: string): Promise<DemoCreator | null> {
  const data = await loadMaster();
  const record = data.creators.find((c) => c.id === creatorId);
  return record ? toResponse(record) : null;
}

/** メール確認済みアカウントを直接作成（パスワードハッシュ渡し） */
export async function createCreatorFromVerification(input: {
  email: string;
  name: string;
  passwordHash: string;
  language: 'ja' | 'en';
  groupId?: string;
}): Promise<DemoCreator> {
  const { email, name, passwordHash, language, groupId } = input;
  const data = await loadMaster();
  const now = new Date().toISOString();
  const record: DemoCreatorRecord = {
    id: crypto.randomUUID(),
    name,
    groupId,
    language,
    email,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  };
  data.creators.push(record);
  await saveMaster(data);
  return toResponse(record);
}

export async function deleteCreator(creatorId: string): Promise<void> {
  const data = await loadMaster();
  const nextCreators = data.creators.filter((c) => c.id !== creatorId);
  if (nextCreators.length === data.creators.length) throw new Error('作成者が見つかりません');
  data.creators = nextCreators;
  await saveMaster(data);

  const projects = await projectService.getAllProjects();
  for (const project of projects) {
    if (project.creatorId === creatorId) {
      await projectService.updateProject(project.id, {
        ...project,
        creatorId: undefined,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}
