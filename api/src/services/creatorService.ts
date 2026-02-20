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
    designerApplicationStatus: r.designerApplicationStatus,
    designerApplicationDate: r.designerApplicationDate,
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
          passwordHash: raw.passwordHash,
          designerApplicationStatus: raw.designerApplicationStatus as DemoCreatorRecord['designerApplicationStatus'],
          designerApplicationReason: raw.designerApplicationReason,
          designerApplicationDate: raw.designerApplicationDate,
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
}): Promise<DemoCreator> {
  const { name, groupId, language, email, role } = input;
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
    createdAt: now,
    updatedAt: now,
  };

  data.creators.push(record);
  await saveMaster(data);
  return toResponse(record);
}

export async function updateCreator(
  creatorId: string,
  input: { name: string; groupId?: string; language: 'ja' | 'en'; email?: string; color?: string },
): Promise<DemoCreator> {
  const { name, groupId, language, email, color } = input;
  const trimmed = name.trim();
  if (!trimmed) throw new Error('作成者名は必須です');
  if (email) validateEmail(email);

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
