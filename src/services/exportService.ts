/**
 * エクスポート / インポートサービス
 * File System Access API でフォルダ選択 → デモ番号付きフォルダ内に JSON + 動画保存
 * 非対応ブラウザでは個別ダウンロードにフォールバック
 */
import type { DemoProject } from '@/types';
import { getVideoBlob } from './videoService';

/** エクスポート用の設定 JSON を生成（バイナリデータ・サムネイルは除外） */
function buildSettingsJson(project: DemoProject): string {
  const exportData = {
    demoNumber: project.demoNumber,
    title: project.title,
    description: project.description,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    video: {
      fileName: project.video.fileName,
      mimeType: project.video.mimeType,
      duration: project.video.duration,
      width: project.video.width,
      height: project.video.height,
    },
    clickPoints: project.clickPoints.map((cp) => ({
      id: cp.id,
      timestamp: cp.timestamp,
      position: cp.position,
      area: cp.area,
      description: cp.description,
      descriptionOffset: cp.descriptionOffset,
      descriptionStyle: cp.descriptionStyle,
      order: cp.order,
      pulseSpeed: cp.pulseSpeed,
    })),
    settings: project.settings,
    version: project.version,
  };
  return JSON.stringify(exportData, null, 2);
}

/** フォルダ名を生成 */
function buildFolderName(project: DemoProject): string {
  const num = String(project.demoNumber || 0).padStart(3, '0');
  return `Demo_${num}`;
}

/** File System Access API の型定義 */
interface FSWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string): Promise<void>;
  close(): Promise<void>;
}

interface FSFileHandle {
  createWritable(): Promise<FSWritableFileStream>;
}

interface FSDirectoryHandle {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FSDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FSFileHandle>;
}

/** File System Access API 対応チェック */
function supportsFileSystemAccess(): boolean {
  return 'showDirectoryPicker' in window;
}

/** File System Access API でエクスポート — フォルダパスを返す */
async function exportWithFileSystemAccess(project: DemoProject): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rootHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' }) as FSDirectoryHandle & { name: string };
  await exportProjectToDir(rootHandle, project);
  const folderName = buildFolderName(project);
  return `${rootHandle.name}/${folderName}`;
}

/** フォールバック: 個別ダウンロード */
async function exportWithDownload(project: DemoProject): Promise<void> {
  const folderPrefix = buildFolderName(project);

  // 設定 JSON
  const jsonBlob = new Blob([buildSettingsJson(project)], { type: 'application/json' });
  downloadBlob(jsonBlob, `${folderPrefix}_settings.json`);

  // 動画ファイル
  const videoBlob = await getVideoBlob(project.video.videoId);
  if (videoBlob) {
    const ext = project.video.mimeType === 'video/webm' ? 'webm' : 'mp4';
    const videoFileName = project.video.fileName || `video.${ext}`;
    downloadBlob(videoBlob, `${folderPrefix}_${videoFileName}`);
  }
}

/**
 * 指定した親ハンドル配下にプロジェクト1件をエクスポート（内部用）
 */
async function exportProjectToDir(
  rootHandle: FSDirectoryHandle,
  project: DemoProject,
): Promise<void> {
  const folderName = buildFolderName(project);
  const dirHandle = await rootHandle.getDirectoryHandle(folderName, { create: true });

  // 設定 JSON
  const jsonHandle = await dirHandle.getFileHandle('settings.json', { create: true });
  const jsonWritable = await jsonHandle.createWritable();
  await jsonWritable.write(buildSettingsJson(project));
  await jsonWritable.close();

  // 動画ファイル
  const videoBlob = await getVideoBlob(project.video.videoId);
  if (videoBlob) {
    const ext = project.video.mimeType === 'video/webm' ? 'webm' : 'mp4';
    const videoFileName = project.video.fileName || `video.${ext}`;
    const videoHandle = await dirHandle.getFileHandle(videoFileName, { create: true });
    const videoWritable = await videoHandle.createWritable();
    await videoWritable.write(videoBlob);
    await videoWritable.close();
  }
}

/**
 * デモをフォルダにエクスポートする
 * File System Access API 対応ブラウザではフォルダ選択ダイアログ → デモ番号フォルダ作成、
 * 非対応ブラウザではプレフィックス付き個別ダウンロード
 */
/** @returns エクスポート先フォルダ名 (File System Access API 時のみ) */
export async function exportDemoToFolder(project: DemoProject): Promise<string | null> {
  if (supportsFileSystemAccess()) {
    return exportWithFileSystemAccess(project);
  } else {
    await exportWithDownload(project);
    return null;
  }
}

/**
 * 全デモを一括でフォルダにエクスポートする
 * File System Access API 対応時はルートフォルダを1回選択 → 各デモをサブフォルダに書き出す
 * 非対応ブラウザでは各デモを個別ダウンロード
 *
 * @returns エクスポートした件数
 */
export async function exportAllDemosToFolder(
  projects: DemoProject[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  if (projects.length === 0) return 0;

  if (supportsFileSystemAccess()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rootHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' }) as FSDirectoryHandle;
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i]!;
      await exportProjectToDir(rootHandle, p);
      onProgress?.(i + 1, projects.length);
    }
  } else {
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i]!;
      await exportWithDownload(p);
      onProgress?.(i + 1, projects.length);
    }
  }
  return projects.length;
}

/** プロジェクトを JSON (.ctdemo) としてエクスポート */
export async function exportProjectAsJson(project: DemoProject): Promise<void> {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, `${project.title || 'demo'}.ctdemo`);
}

/** .ctdemo ファイルからプロジェクトデータを読み込む */
export async function importProjectFromFile(file: File): Promise<DemoProject> {
  const text = await file.text();
  const data = JSON.parse(text) as DemoProject;
  if (!data.title || !data.video || !Array.isArray(data.clickPoints)) {
    throw new Error('無効なプロジェクトファイルです。');
  }
  return data;
}

// ---- ユーティリティ ----

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
