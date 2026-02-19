/**
 * API 共有型定義
 */

export interface DemoProject {
  id: string;
  demoNumber: number;
  title: string;
  groupId?: string;
  creatorId?: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  video: VideoInfo;
  clickPoints: ClickPoint[];
  settings: DemoSettings;
  version: number;
  // ソーシャルカウント（集計値、実データは socialService で管理）
  likeCount?: number;
  playCount?: number;
  totalPlayDuration?: number;
  commentCount?: number;
}

export interface VideoInfo {
  videoId: string;
  fileName: string;
  mimeType: 'video/mp4' | 'video/webm';
  duration: number;
  width: number;
  height: number;
  thumbnailDataUrl: string;
}

export interface ClickPoint {
  id: string;
  timestamp: number;
  position: Position;
  area: ClickArea;
  description: string;
  descriptionOffset: Position;
  descriptionStyle: DescriptionStyle;
  order: number;
  pulseSpeed: number;
}

export interface Position {
  x: number;
  y: number;
}

export type ClickArea =
  | { type: 'circle'; radius: number }
  | { type: 'rectangle'; width: number; height: number };

export interface DescriptionStyle {
  templateId: string;
  color: string;
  backgroundColor: string;
  fontSize: number;
  borderColor: string;
  borderRadius: number;
}

export interface DemoSettings {
  autoStart: boolean;
  showProgress: boolean;
  completionMessage: string;
  allowSkip: boolean;
  defaultDescriptionStyle: DescriptionStyle;
}

export type UserRole = 'viewer' | 'designer';

export interface JwtPayload {
  role: UserRole;
  creatorId?: string;  // email ログイン時に設定
  iat: number;
  exp: number;
}

export interface AuthResult {
  role: UserRole;
  creatorId?: string;
}

export interface DemoGroup {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** ストレージ内部用（passwordHash を含む） */
export interface DemoCreatorRecord {
  id: string;
  name: string;
  groupId?: string;
  language: 'ja' | 'en';
  role?: UserRole;        // 未設定の場合は既存ユーザーのため 'designer' にフォールバック
  email?: string;         // @microsoft.com のみ許可
  passwordHash?: string;  // 後方互換用（新規作成には使わない）
  designerApplicationStatus?: 'pending' | 'approved' | 'rejected';
  designerApplicationReason?: string;
  designerApplicationDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** API レスポンス用 */
export interface DemoCreator {
  id: string;
  name: string;
  groupId?: string;
  language: 'ja' | 'en';
  role: UserRole;
  email?: string;
  designerApplicationStatus?: 'pending' | 'approved' | 'rejected';
  designerApplicationDate?: string;
  createdAt: string;
  updatedAt: string;
}

// ── ソーシャル機能 ──────────────────────────────────────────

export interface DemoLike {
  id: string;
  demoId: string;
  creatorId: string;
  createdAt: string;
}

export interface DemoComment {
  id: string;
  demoId: string;
  creatorId: string;
  creatorName: string;
  body: string;
  createdAt: string;
}

export interface DemoFavorite {
  id: string;
  demoId: string;
  creatorId: string;
  createdAt: string;
}

export type FeedEventType = 'like' | 'comment' | 'new_demo' | 'new_designer';

export interface FeedEntry {
  id: string;
  eventType: FeedEventType;
  actorId: string;
  actorName: string;
  demoId?: string;
  demoTitle?: string;
  commentBody?: string;
  createdAt: string;
}
