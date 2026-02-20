/**
 * グループマスター管理サービス
 */
import crypto from 'node:crypto';
import type { DemoGroup } from '../shared/types.js';
import * as blob from './blobService.js';
import * as projectService from './projectService.js';

interface GroupMasterData {
  version: number;
  groups: DemoGroup[];
}

const EMPTY_DATA: GroupMasterData = {
  version: 1,
  groups: [],
};

async function loadMaster(): Promise<GroupMasterData> {
  const json = await blob.getGroupMasterJson();
  if (!json) return { ...EMPTY_DATA };
  try {
    const data = JSON.parse(json) as Partial<GroupMasterData>;
    const groups = Array.isArray(data.groups) ? data.groups : [];
    return {
      version: 1,
      groups,
    };
  } catch {
    return { ...EMPTY_DATA };
  }
}

async function saveMaster(data: GroupMasterData): Promise<void> {
  await blob.putGroupMasterJson(JSON.stringify(data));
}

export async function getAllGroups(): Promise<DemoGroup[]> {
  const data = await loadMaster();
  return [...data.groups].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

export async function createGroup(name: string, color?: string): Promise<DemoGroup> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('グループ名は必須です');
  }

  const data = await loadMaster();
  const exists = data.groups.some((g) => g.name.toLowerCase() === trimmed.toLowerCase());
  if (exists) {
    throw new Error('同名のグループがすでに存在します');
  }

  const now = new Date().toISOString();
  const group: DemoGroup = {
    id: crypto.randomUUID(),
    name: trimmed,
    ...(color ? { color } : {}),
    createdAt: now,
    updatedAt: now,
  };

  data.groups.push(group);
  await saveMaster(data);
  return group;
}

export async function updateGroup(groupId: string, name: string, color?: string): Promise<DemoGroup> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('グループ名は必須です');
  }

  const data = await loadMaster();
  const index = data.groups.findIndex((g) => g.id === groupId);
  if (index < 0) {
    throw new Error('グループが見つかりません');
  }

  const exists = data.groups.some(
    (g) => g.id !== groupId && g.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exists) {
    throw new Error('同名のグループがすでに存在します');
  }

  const updated: DemoGroup = {
    ...data.groups[index]!,
    name: trimmed,
    color: color ?? data.groups[index]!.color,
    updatedAt: new Date().toISOString(),
  };
  data.groups[index] = updated;
  await saveMaster(data);
  return updated;
}

export async function deleteGroup(groupId: string): Promise<void> {
  const data = await loadMaster();
  const nextGroups = data.groups.filter((g) => g.id !== groupId);
  if (nextGroups.length === data.groups.length) {
    throw new Error('グループが見つかりません');
  }

  data.groups = nextGroups;
  await saveMaster(data);

  const projects = await projectService.getAllProjects();
  for (const project of projects) {
    if (project.groupId === groupId) {
      await projectService.updateProject(project.id, {
        ...project,
        groupId: undefined,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}
