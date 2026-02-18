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

/** メール認証待ちの登録情報 */
export interface PendingRegistration {
  token: string;
  email: string;
  name: string;
  passwordHash: string;
  language: 'ja' | 'en';
  groupId?: string;
  createdAt: string;
  expiresAt: string;  // 24時間有効
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
  email?: string;         // @microsoft.com のみ許可
  passwordHash?: string;  // SHA-256 hex
  createdAt: string;
  updatedAt: string;
}

/** API レスポンス用（passwordHash を除外、hasPassword を追加） */
export interface DemoCreator {
  id: string;
  name: string;
  groupId?: string;
  language: 'ja' | 'en';
  email?: string;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}
