/**
 * 作成者マスター管理サービス
 */
import crypto from 'node:crypto';
import type { DemoCreator } from '../shared/types.js';
import * as blob from './blobService.js';
import * as projectService from './projectService.js';

interface CreatorMasterData {
  version: number;
  creators: DemoCreator[];
}

const EMPTY_DATA: CreatorMasterData = {
  version: 1,
  creators: [],
};

async function loadMaster(): Promise<CreatorMasterData> {
  const json = await blob.getCreatorMasterJson();
  if (!json) return { ...EMPTY_DATA };
  try {
    const data = JSON.parse(json) as Partial<CreatorMasterData>;
    const creators = Array.isArray(data.creators) ? data.creators : [];
    return {
      version: 1,
      creators,
    };
  } catch {
    return { ...EMPTY_DATA };
  }
}

async function saveMaster(data: CreatorMasterData): Promise<void> {
  await blob.putCreatorMasterJson(JSON.stringify(data));
}

export async function getAllCreators(): Promise<DemoCreator[]> {
  const data = await loadMaster();
  return [...data.creators].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

export async function createCreator(name: string): Promise<DemoCreator> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('作成者名は必須です');
  }

  const data = await loadMaster();
  const exists = data.creators.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  if (exists) {
    throw new Error('同名の作成者がすでに存在します');
  }

  const now = new Date().toISOString();
  const creator: DemoCreator = {
    id: crypto.randomUUID(),
    name: trimmed,
    createdAt: now,
    updatedAt: now,
  };

  data.creators.push(creator);
  await saveMaster(data);
  return creator;
}

export async function updateCreator(creatorId: string, name: string): Promise<DemoCreator> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('作成者名は必須です');
  }

  const data = await loadMaster();
  const index = data.creators.findIndex((c) => c.id === creatorId);
  if (index < 0) {
    throw new Error('作成者が見つかりません');
  }

  const exists = data.creators.some(
    (c) => c.id !== creatorId && c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exists) {
    throw new Error('同名の作成者がすでに存在します');
  }

  const updated: DemoCreator = {
    ...data.creators[index]!,
    name: trimmed,
    updatedAt: new Date().toISOString(),
  };
  data.creators[index] = updated;
  await saveMaster(data);
  return updated;
}

export async function deleteCreator(creatorId: string): Promise<void> {
  const data = await loadMaster();
  const nextCreators = data.creators.filter((c) => c.id !== creatorId);
  if (nextCreators.length === data.creators.length) {
    throw new Error('作成者が見つかりません');
  }

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
