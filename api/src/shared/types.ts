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
  iat: number;
  exp: number;
}

export interface AuthResult {
  role: UserRole;
}

export interface DemoGroup {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemoCreator {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
