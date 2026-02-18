/**
 * projectStore — プロジェクト一覧の CRUD 管理
 */
import { create } from 'zustand';
import type { DemoProject } from '@/types';
import * as projectService from '@/services/projectService';

interface ProjectStoreState {
  projects: DemoProject[];
  isLoading: boolean;
  error: string | null;
}

interface ProjectStoreActions {
  loadProjects: () => Promise<void>;
  getProject: (id: string) => Promise<DemoProject | undefined>;
  createProject: (
    data: Omit<DemoProject, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<DemoProject>;
  updateProject: (id: string, updates: Partial<DemoProject>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<DemoProject>;
}

export const useProjectStore = create<ProjectStoreState & ProjectStoreActions>((set, get) => ({
  projects: [],
  isLoading: false,
  error: null,

  loadProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const projects = await projectService.getAllProjects();
      // 更新日降順
      projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      set({ projects, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  getProject: async (id: string) => {
    // まずメモリ上を検索、なければDBから
    const cached = get().projects.find((p) => p.id === id);
    if (cached) return cached;
    return projectService.getProject(id);
  },

  createProject: async (data) => {
    const project = await projectService.createProject(data);
    set((state) => ({ projects: [project, ...state.projects] }));
    return project;
  },

  updateProject: async (id, updates) => {
    await projectService.updateProject(id, updates);
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p,
      ),
    }));
  },

  deleteProject: async (id) => {
    await projectService.deleteProject(id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    }));
  },

  duplicateProject: async (id) => {
    const dup = await projectService.duplicateProject(id);
    set((state) => ({ projects: [dup, ...state.projects] }));
    return dup;
  },
}));
