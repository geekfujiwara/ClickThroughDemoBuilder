/**
 * designerStore — デザイナー画面の状態管理（選択、ツール、Undo/Redo）
 */
import { create } from 'zustand';
import type { DemoProject, ClickPoint, DescriptionStyle } from '@/types';
import { generateId } from '@/utils/id';

const MAX_UNDO_STACK = 50;

// ---- State ----

interface DesignerStoreState {
  currentProject: DemoProject | null;
  selectedElementId: string | null;
  selectedElementType: 'clickPoint' | null;
  activeTool: 'select' | 'addClickPoint' | null;
  isDirty: boolean;
  undoStack: DemoProject[];
  redoStack: DemoProject[];
}

// ---- Actions ----

interface DesignerStoreActions {
  setProject: (project: DemoProject) => void;
  resetDesigner: () => void;
  selectElement: (id: string | null, type?: 'clickPoint') => void;
  setActiveTool: (tool: DesignerStoreState['activeTool']) => void;

  // クリックポイント操作
  addClickPoint: (cp: Omit<ClickPoint, 'id'>) => void;
  updateClickPoint: (id: string, updates: Partial<ClickPoint>) => void;
  removeClickPoint: (id: string) => void;
  removeClickPoints: (ids: string[]) => void;
  removeAllClickPoints: () => void;

  // 説明テキストスタイル一括変更
  bulkUpdateDescriptionStyle: (style: DescriptionStyle) => void;

  // プロジェクトメタデータ更新（タイトル、説明、エクスポート情報等）
  updateProjectMeta: (updates: Partial<Pick<DemoProject, 'title' | 'groupId' | 'creatorId' | 'description' | 'lastExportFolderName' | 'lastExportedAt'>>) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  pushSnapshot: () => void;

  // 保存フラグ
  markSaved: () => void;

  // 動画差し替え
  replaceVideo: (project: DemoProject) => void;
}

// ---- Store ----

const initialState: DesignerStoreState = {
  currentProject: null,
  selectedElementId: null,
  selectedElementType: null,
  activeTool: 'select',
  isDirty: false,
  undoStack: [],
  redoStack: [],
};

export const useDesignerStore = create<DesignerStoreState & DesignerStoreActions>((set, get) => ({
  ...initialState,

  setProject: (project) =>
    set({
      currentProject: project,
      selectedElementId: null,
      selectedElementType: null,
      isDirty: false,
      undoStack: [],
      redoStack: [],
    }),

  resetDesigner: () => set(initialState),

  selectElement: (id, type) =>
    set({
      selectedElementId: id,
      selectedElementType: type ?? null,
    }),

  setActiveTool: (tool) =>
    set({
      activeTool: tool,
      selectedElementId: null,
      selectedElementType: null,
    }),

  // ---- クリックポイント ----

  addClickPoint: (cp) => {
    const state = get();
    if (!state.currentProject) return;
    state.pushSnapshot();

    const newCp: ClickPoint = { ...cp, id: generateId() };
    const clickPoints = [...state.currentProject.clickPoints, newCp].sort(
      (a, b) => a.order - b.order,
    );

    set({
      currentProject: { ...state.currentProject, clickPoints },
      isDirty: true,
      selectedElementId: newCp.id,
      selectedElementType: 'clickPoint',
    });
  },

  updateClickPoint: (id, updates) => {
    const state = get();
    if (!state.currentProject) return;
    state.pushSnapshot();

    const clickPoints = state.currentProject.clickPoints.map((cp) =>
      cp.id === id ? { ...cp, ...updates } : cp,
    );

    set({
      currentProject: { ...state.currentProject, clickPoints },
      isDirty: true,
    });
  },

  removeClickPoint: (id) => {
    const state = get();
    if (!state.currentProject) return;
    state.pushSnapshot();

    const clickPoints = state.currentProject.clickPoints
      .filter((cp) => cp.id !== id)
      .map((cp, i) => ({ ...cp, order: i + 1 }));

    set({
      currentProject: { ...state.currentProject, clickPoints },
      isDirty: true,
      selectedElementId: null,
      selectedElementType: null,
    });
  },

  removeClickPoints: (ids) => {
    const state = get();
    if (!state.currentProject) return;
    if (ids.length === 0) return;
    state.pushSnapshot();

    const idSet = new Set(ids);
    const clickPoints = state.currentProject.clickPoints
      .filter((cp) => !idSet.has(cp.id))
      .map((cp, i) => ({ ...cp, order: i + 1 }));

    set({
      currentProject: { ...state.currentProject, clickPoints },
      isDirty: true,
      selectedElementId: null,
      selectedElementType: null,
    });
  },

  removeAllClickPoints: () => {
    const state = get();
    if (!state.currentProject) return;
    if (state.currentProject.clickPoints.length === 0) return;
    state.pushSnapshot();

    set({
      currentProject: { ...state.currentProject, clickPoints: [] },
      isDirty: true,
      selectedElementId: null,
      selectedElementType: null,
    });
  },

  // ---- 説明テキストスタイル一括変更 ----

  bulkUpdateDescriptionStyle: (style) => {
    const state = get();
    if (!state.currentProject) return;
    state.pushSnapshot();

    const clickPoints = state.currentProject.clickPoints.map((cp) => ({
      ...cp,
      descriptionStyle: { ...style },
    }));

    set({
      currentProject: { ...state.currentProject, clickPoints },
      isDirty: true,
    });
  },

  // ---- プロジェクトメタデータ更新 ----

  updateProjectMeta: (updates) => {
    const state = get();
    if (!state.currentProject) return;
    state.pushSnapshot();

    set({
      currentProject: { ...state.currentProject, ...updates },
      isDirty: true,
    });
  },

  // ---- Undo / Redo ----

  pushSnapshot: () => {
    const state = get();
    if (!state.currentProject) return;
    const stack = [...state.undoStack, structuredClone(state.currentProject)];
    if (stack.length > MAX_UNDO_STACK) stack.shift();
    set({ undoStack: stack, redoStack: [] });
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0 || !state.currentProject) return;
    const newUndo = [...state.undoStack];
    const prev = newUndo.pop()!;
    set({
      undoStack: newUndo,
      redoStack: [...state.redoStack, structuredClone(state.currentProject)],
      currentProject: prev,
      isDirty: true,
    });
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0 || !state.currentProject) return;
    const newRedo = [...state.redoStack];
    const next = newRedo.pop()!;
    set({
      redoStack: newRedo,
      undoStack: [...state.undoStack, structuredClone(state.currentProject)],
      currentProject: next,
      isDirty: true,
    });
  },

  markSaved: () => set({ isDirty: false }),

  replaceVideo: (project) => {
    set({
      currentProject: {
        ...project,
        clickPoints: [],
      },
      isDirty: true,
      undoStack: [],
      redoStack: [],
      selectedElementId: null,
      selectedElementType: null,
    });
  },
}));
