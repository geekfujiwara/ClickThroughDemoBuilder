/**
 * 作成者マスター管理サービス
 */
import crypto from 'node:crypto';
import type { DemoCreator, DemoCreatorRecord, UserRole } from '../shared/types.js';
import * as blob from './blobService.js';
import * as projectService from './projectService.js';

interface CreatorMasterData {
  version: number;
  creators: DemoCreatorRecord[];
}

const EMPTY_DATA: CreatorMasterData = { version: 1, creators: [] };

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

/** SNS などの URL を検証・正規化する（http/https のみ許可） */
function normalizeUrl(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('URL の形式が正しくありません');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL は http または https で始まる必要があります');
  }
  return parsed.toString();
}

function toResponse(r: DemoCreatorRecord): DemoCreator {
  return {
    id: r.id,
    name: r.name,
    groupId: r.groupId,
    color: r.color,
    language: r.language,
    // role 未設定の既存ユーザーは 'designer' にフォールバック（後方互換）
    role: r.role ?? 'designer',
    email: r.email,
    entraOid: r.entraOid,
    designerApplicationStatus: r.designerApplicationStatus,
    designerApplicationReason: r.designerApplicationReason,
    designerApplicationDate: r.designerApplicationDate,
    isBlocked: r.isBlocked,
    bio: r.bio,
    xUrl: r.xUrl,
    linkedInUrl: r.linkedInUrl,
    youTubeUrl: r.youTubeUrl,
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
          role: raw.role as UserRole | undefined,
          email: raw.email,
          entraOid: raw.entraOid,
          passwordHash: raw.passwordHash,
          designerApplicationStatus: raw.designerApplicationStatus as DemoCreatorRecord['designerApplicationStatus'],
          designerApplicationReason: raw.designerApplicationReason,
          designerApplicationDate: raw.designerApplicationDate,
          isBlocked: raw.isBlocked,
          bio: raw.bio,
          xUrl: raw.xUrl,
          linkedInUrl: raw.linkedInUrl,
          youTubeUrl: raw.youTubeUrl,
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
  role?: UserRole;
  entraOid?: string;
}): Promise<DemoCreator> {
  const { name, groupId, language, email, role, entraOid } = input;
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
    role: role ?? 'designer',
    email: email?.toLowerCase().trim() || undefined,
    entraOid: entraOid || undefined,
    createdAt: now,
    updatedAt: now,
  };

  data.creators.push(record);
  await saveMaster(data);
  return toResponse(record);
}

export async function updateCreator(
  creatorId: string,
  input: {
    name: string;
    groupId?: string;
    language: 'ja' | 'en';
    email?: string;
    color?: string;
    bio?: string;
    xUrl?: string;
    linkedInUrl?: string;
    youTubeUrl?: string;
  },
): Promise<DemoCreator> {
  const { name, groupId, language, email, color, bio, xUrl, linkedInUrl, youTubeUrl } = input;
  const trimmed = name.trim();
  if (!trimmed) throw new Error('作成者名は必須です');
  if (email) validateEmail(email);
  if (bio !== undefined && bio.length > 1000) throw new Error('自己紹介は1000文字以内です');
  const normalizedX = normalizeUrl(xUrl);
  const normalizedLinkedIn = normalizeUrl(linkedInUrl);
  const normalizedYouTube = normalizeUrl(youTubeUrl);

  const data = await loadMaster();
  const index = data.creators.findIndex((c) => c.id === creatorId);
  if (index < 0) throw new Error('作成者が見つかりません');

  if (data.creators.some((c) => c.id !== creatorId && c.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error('同名の作成者がすでに存在します');
  }

  const existing = data.creators[index]!;
  const updated: DemoCreatorRecord = {
    ...existing,
    name: trimmed,
    groupId,
    color: color !== undefined ? (color || undefined) : existing.color,
    language,
    email: email !== undefined ? (email.toLowerCase().trim() || undefined) : existing.email,
    bio: bio !== undefined ? (bio.trim() || undefined) : existing.bio,
    xUrl: xUrl !== undefined ? normalizedX : existing.xUrl,
    linkedInUrl: linkedInUrl !== undefined ? normalizedLinkedIn : existing.linkedInUrl,
    youTubeUrl: youTubeUrl !== undefined ? normalizedYouTube : existing.youTubeUrl,
    updatedAt: new Date().toISOString(),
  };
  data.creators[index] = updated;
  await saveMaster(data);
  return toResponse(updated);
}

/** メールアドレスでクリエイターを検索（Entra SSO ログイン時に使用） */
export async function findCreatorByEmail(email: string): Promise<DemoCreator | null> {
  const lower = email.toLowerCase().trim();
  if (!lower) return null;
  const data = await loadMaster();
  const record = data.creators.find((c) => c.email?.toLowerCase() === lower);
  return record ? toResponse(record) : null;
}

/** Entra Object ID でクリエイターを検索（複数エイリアスでも同一ユーザーを特定） */
export async function findCreatorByOid(oid: string): Promise<DemoCreator | null> {
  if (!oid) return null;
  const data = await loadMaster();
  const record = data.creators.find((c) => c.entraOid === oid);
  return record ? toResponse(record) : null;
}

/** クリエイターの Entra OID とメールアドレスを更新する */
export async function updateCreatorEntraOid(
  creatorId: string,
  oid: string,
  email?: string,
): Promise<DemoCreator> {
  const data = await loadMaster();
  const index = data.creators.findIndex((c) => c.id === creatorId);
  if (index < 0) throw new Error('作成者が見つかりません');
  const existing = data.creators[index]!;
  const updated: DemoCreatorRecord = {
    ...existing,
    entraOid: oid,
    ...(email ? { email: email.toLowerCase().trim() } : {}),
    updatedAt: new Date().toISOString(),
  };
  data.creators[index] = updated;
  await saveMaster(data);
  return toResponse(updated);
}

/** ID でクリエイターを取得 */
export async function getCreatorById(creatorId: string): Promise<DemoCreator | null> {
  const data = await loadMaster();
  const record = data.creators.find((c) => c.id === creatorId);
  return record ? toResponse(record) : null;
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

/** デザイナー権限申請 */
export async function applyDesigner(creatorId: string, reason: string): Promise<DemoCreator> {
  const data = await loadMaster();
  const index = data.creators.findIndex((c) => c.id === creatorId);
  if (index < 0) throw new Error('作成者が見つかりません');
  const existing = data.creators[index]!;
  if ((existing.role ?? 'designer') === 'designer') {
    throw new Error('すでにデザイナー権限を持っています');
  }
  if (existing.designerApplicationStatus === 'pending') {
    throw new Error('すでに申請中です');
  }
  const updated: DemoCreatorRecord = {
    ...existing,
    designerApplicationStatus: 'pending',
    designerApplicationReason: reason.trim(),
    designerApplicationDate: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.creators[index] = updated;
  await saveMaster(data);
  return toResponse(updated);
}

/** デザイナー権限承認 */
export async function verifyDesigner(creatorId: string): Promise<DemoCreator> {
  const data = await loadMaster();
  const index = data.creators.findIndex((c) => c.id === creatorId);
  if (index < 0) throw new Error('作成者が見つかりません');
  const existing = data.creators[index]!;
  const updated: DemoCreatorRecord = {
    ...existing,
    role: 'designer',
    designerApplicationStatus: 'approved',
    updatedAt: new Date().toISOString(),
  };
  data.creators[index] = updated;
  await saveMaster(data);
  return toResponse(updated);
}

/** クリエイター情報取得（ロール含む）*/
export async function getCreatorRoleById(creatorId: string): Promise<UserRole> {
  const data = await loadMaster();
  const record = data.creators.find((c) => c.id === creatorId);
  return record?.role ?? 'designer';
}

// ── 管理者機能 ──────────────────────────────────────────

/** ユーザーのロールを変更する */
export async function changeUserRole(creatorId: string, newRole: UserRole): Promise<DemoCreator> {
  const data = await loadMaster();
  const index = data.creators.findIndex((c) => c.id === creatorId);
  if (index < 0) throw new Error('作成者が見つかりません');
  const existing = data.creators[index]!;
  const updated: DemoCreatorRecord = {
    ...existing,
    role: newRole,
    // designer に昇格する場合は申請ステータスも approved にする
    ...(newRole === 'designer' || newRole === 'user_admin' || newRole === 'system_admin'
      ? { designerApplicationStatus: 'approved' as const }
      : {}),
    updatedAt: new Date().toISOString(),
  };
  data.creators[index] = updated;
  await saveMaster(data);
  return toResponse(updated);
}

/** ユーザーをブロック */
export async function blockUser(creatorId: string): Promise<DemoCreator> {
  const data = await loadMaster();
  const index = data.creators.findIndex((c) => c.id === creatorId);
  if (index < 0) throw new Error('作成者が見つかりません');
  const existing = data.creators[index]!;
  const updated: DemoCreatorRecord = {
    ...existing,
    isBlocked: true,
    updatedAt: new Date().toISOString(),
  };
  data.creators[index] = updated;
  await saveMaster(data);
  return toResponse(updated);
}

/** ユーザーのブロックを解除 */
export async function unblockUser(creatorId: string): Promise<DemoCreator> {
  const data = await loadMaster();
  const index = data.creators.findIndex((c) => c.id === creatorId);
  if (index < 0) throw new Error('作成者が見つかりません');
  const existing = data.creators[index]!;
  const updated: DemoCreatorRecord = {
    ...existing,
    isBlocked: false,
    updatedAt: new Date().toISOString(),
  };
  data.creators[index] = updated;
  await saveMaster(data);
  return toResponse(updated);
}

/** デザイナー申請一覧取得 (pending のもの) */
export async function getPendingApplications(): Promise<DemoCreator[]> {
  const data = await loadMaster();
  return data.creators
    .filter((c) => c.designerApplicationStatus === 'pending')
    .sort((a, b) => (b.designerApplicationDate ?? '').localeCompare(a.designerApplicationDate ?? ''))
    .map(toResponse);
}

/** ユーザーの所属組織を変更する */
export async function changeUserGroup(creatorId: string, groupId: string | null): Promise<DemoCreator> {
  const data = await loadMaster();
  const index = data.creators.findIndex((c) => c.id === creatorId);
  if (index < 0) throw new Error('作成者が見つかりません');
  const existing = data.creators[index]!;
  const updated: DemoCreatorRecord = {
    ...existing,
    groupId: groupId ?? undefined,
    updatedAt: new Date().toISOString(),
  };
  data.creators[index] = updated;
  await saveMaster(data);
  return toResponse(updated);
}

/** デザイナー申請を拒否 */
export async function rejectDesigner(creatorId: string): Promise<DemoCreator> {
  const data = await loadMaster();
  const index = data.creators.findIndex((c) => c.id === creatorId);
  if (index < 0) throw new Error('作成者が見つかりません');
  const existing = data.creators[index]!;
  const updated: DemoCreatorRecord = {
    ...existing,
    designerApplicationStatus: 'rejected',
    updatedAt: new Date().toISOString(),
  };
  data.creators[index] = updated;
  await saveMaster(data);
  return toResponse(updated);
}
