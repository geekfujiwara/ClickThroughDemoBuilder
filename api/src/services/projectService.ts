/**
 * プロジェクト CRUD サービス (Blob Storage バックエンド)
 */
import type { DemoProject } from '../shared/types.js';
import * as blob from './blobService.js';

/** 全プロジェクト取得 (一覧用) */
export async function getAllProjects(): Promise<DemoProject[]> {
  const ids = await blob.listProjectIds();
  const results: DemoProject[] = [];
  for (const id of ids) {
    const json = await blob.getProjectJson(id);
    if (json) {
      try {
        results.push(JSON.parse(json) as DemoProject);
      } catch {
        // 壊れた JSON は無視
      }
    }
  }
  // updatedAt 降順
  results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return results;
}

/** 単一プロジェクト取得 */
export async function getProject(id: string): Promise<DemoProject | null> {
  const json = await blob.getProjectJson(id);
  if (!json) return null;
  return JSON.parse(json) as DemoProject;
}

/** プロジェクト作成 */
export async function createProject(project: DemoProject): Promise<void> {
  await blob.putProjectJson(project.id, JSON.stringify(project));
}

/** プロジェクト更新 */
export async function updateProject(id: string, data: DemoProject): Promise<void> {
  await blob.putProjectJson(id, JSON.stringify(data));
}

/** プロジェクト削除 (JSON + 動画) */
export async function deleteProject(id: string): Promise<void> {
  await blob.deleteProjectBlob(id);
  await blob.deleteProjectVideo(id);
}

/** プロジェクト複製 */
export async function duplicateProject(
  originalId: string,
  newId: string,
): Promise<DemoProject | null> {
  const original = await getProject(originalId);
  if (!original) return null;

  const now = new Date().toISOString();
  // 全プロジェクトの最大 demoNumber を取得
  const all = await getAllProjects();
  const maxNum = all.reduce((m, p) => Math.max(m, p.demoNumber ?? 0), 0);

  const dup: DemoProject = {
    ...original,
    id: newId,
    demoNumber: maxNum + 1,
    title: `${original.title} (コピー)`,
    createdAt: now,
    updatedAt: now,
  };
  await createProject(dup);
  return dup;
}
