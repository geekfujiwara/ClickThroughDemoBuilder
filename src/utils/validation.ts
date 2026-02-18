/**
 * バリデーションヘルパー
 */
import type { ClickPoint, DemoProject } from '@/types';

// ---- 制約定数 ----
export const MAX_CLICK_POINTS = 50;
export const MAX_TITLE_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_CP_DESCRIPTION_LENGTH = 200;
export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
export const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm'] as const;
export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 32;

// ---- バリデーション関数 ----

export function validateTitle(title: string): string | null {
  const trimmed = title.trim();
  if (trimmed.length === 0) return 'タイトルを入力してください。';
  if (trimmed.length > MAX_TITLE_LENGTH) return `タイトルは${MAX_TITLE_LENGTH}文字以内です。`;
  return null;
}

export function validateVideoFile(file: File): string | null {
  if (!SUPPORTED_VIDEO_TYPES.includes(file.type as (typeof SUPPORTED_VIDEO_TYPES)[number])) {
    return 'MP4 または WebM 形式の動画を選択してください。';
  }
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return 'ファイルサイズは 500MB 以下にしてください。';
  }
  return null;
}

export function validateClickPointAdd(
  project: Pick<DemoProject, 'clickPoints'>,
  timestamp: number,
): string | null {
  if (project.clickPoints.length >= MAX_CLICK_POINTS) {
    return `クリックポイントは最大${MAX_CLICK_POINTS}個までです。`;
  }
  const dup = project.clickPoints.find((cp) => Math.abs(cp.timestamp - timestamp) < 0.05);
  if (dup) {
    return 'このタイムスタンプにはすでにクリックポイントがあります。';
  }
  return null;
}

export function validatePosition(x: number, y: number): boolean {
  return x >= 0 && x <= 100 && y >= 0 && y <= 100;
}

export function validateClickPoint(cp: ClickPoint, videoDuration: number): string[] {
  const errors: string[] = [];
  if (cp.timestamp < 0 || cp.timestamp > videoDuration) {
    errors.push('タイムスタンプが動画の範囲外です。');
  }
  if (!validatePosition(cp.position.x, cp.position.y)) {
    errors.push('座標が範囲外です (0-100)。');
  }
  if (cp.description.length > MAX_CP_DESCRIPTION_LENGTH) {
    errors.push(`説明は${MAX_CP_DESCRIPTION_LENGTH}文字以内です。`);
  }
  return errors;
}


