/**
 * プロジェクトの永続化サービス (Azure API バックエンド)
 */
import type { DemoProject } from '@/types';
import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';
import { generateId } from '@/utils/id';

/** 全プロジェクト取得 (designer) */
export async function getAllProjects(): Promise<DemoProject[]> {
  return apiGet<DemoProject[]>('/projects');
}

/** 単一プロジェクト取得 */
export async function getProject(id: string): Promise<DemoProject | undefined> {
  try {
    return await apiGet<DemoProject>(`/projects/${id}`);
  } catch {
    return undefined;
  }
}

/** プロジェクト作成 — id, createdAt, updatedAt, demoNumber をクライアント側で付与 */
export async function createProject(
  data: Omit<DemoProject, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<DemoProject> {
  const now = new Date().toISOString();

  // demoNumber 自動付番: 一覧を取得して最大値 + 1
  let demoNumber = data.demoNumber;
  if (!demoNumber || demoNumber <= 0) {
    try {
      const all = await getAllProjects();
      const maxNum = all.reduce((m, p) => Math.max(m, p.demoNumber ?? 0), 0);
      demoNumber = maxNum + 1;
    } catch {
      demoNumber = 1;
    }
  }

  const project: DemoProject = {
    ...data,
    demoNumber,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  await apiPost<DemoProject>('/projects', project);
  return project;
}

/** プロジェクト更新 */
export async function updateProject(
  id: string,
  updates: Partial<DemoProject>,
): Promise<void> {
  // 既存を取得してマージ
  const existing = await getProject(id);
  if (!existing) throw new Error(`Project not found: ${id}`);
  const updated: DemoProject = {
    ...existing,
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };
  await apiPut<DemoProject>(`/projects/${id}`, updated);
}

/** プロジェクト削除 */
export async function deleteProject(id: string): Promise<void> {
  await apiDelete(`/projects/${id}`);
}

/** プロジェクト複製 */
export async function duplicateProject(id: string): Promise<DemoProject> {
  return apiPost<DemoProject>(`/projects/${id}/duplicate`);
}
