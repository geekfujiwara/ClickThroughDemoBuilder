// ============================================================
// DemoProject — プロジェクトのルート型
// ============================================================

export interface DemoProject {
  id: string;
  demoNumber: number; // 自動付番
  title: string;
  groupId?: string;
  creatorId?: string;
  description: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  video: VideoInfo;
  clickPoints: ClickPoint[];
  settings: DemoSettings;
  version: number; // スキーマバージョン
  lastExportFolderName?: string; // 最後にエクスポートしたフォルダパス
  lastExportedAt?: string; // 最後にエクスポートした日時 (ISO 8601)
  // ソーシャルカウント
  likeCount?: number;
  commentCount?: number;
  playCount?: number;
  totalPlayDuration?: number;
}

// ============================================================
// VideoInfo — 動画メタデータ
// ============================================================

export interface VideoInfo {
  videoId: string;
  fileName: string;
  mimeType: 'video/mp4' | 'video/webm';
  duration: number;
  width: number;
  height: number;
  thumbnailDataUrl: string;
}

// ============================================================
// ClickPoint — クリックポイント
// ============================================================

export interface ClickPoint {
  id: string;
  timestamp: number;
  position: Position;
  area: ClickArea;
  description: string;
  descriptionOffset: Position; // CP位置からの相対オフセット (%)
  descriptionStyle: DescriptionStyle;
  order: number;
  pulseSpeed: PulseSpeed;
}

export interface Position {
  x: number; // 0-100 (%)
  y: number; // 0-100 (%)
}

export type ClickArea =
  | { type: 'circle'; radius: number }
  | { type: 'rectangle'; width: number; height: number };

export type PulseSpeed = 1 | 2 | 3 | 4 | 5;

/** パルス速度 → CSS animation-duration (秒) */
export const PULSE_DURATION_MAP: Record<PulseSpeed, number> = {
  1: 2.0,
  2: 1.6,
  3: 1.2,
  4: 0.8,
  5: 0.5,
};

// ============================================================
// DescriptionStyle — 説明テキストのスタイル
// ============================================================

export type DescriptionTemplateId = 'default' | 'dark' | 'accent' | 'minimal' | 'highlight';

export interface DescriptionStyle {
  templateId: DescriptionTemplateId;
  color: string;
  backgroundColor: string;
  fontSize: number;
  borderColor: string;
  borderRadius: number;
}

export interface DescriptionTemplate {
  id: DescriptionTemplateId;
  label: string;
  style: Omit<DescriptionStyle, 'templateId'>;
}

export const DESCRIPTION_TEMPLATES: DescriptionTemplate[] = [
  {
    id: 'default',
    label: 'デフォルト',
    style: { color: '#242424', backgroundColor: '#FFFFFFEE', fontSize: 13, borderColor: '#0078D4', borderRadius: 6 },
  },
  {
    id: 'dark',
    label: 'ダーク',
    style: { color: '#FFFFFF', backgroundColor: '#000000CC', fontSize: 13, borderColor: '#555555', borderRadius: 6 },
  },
  {
    id: 'accent',
    label: 'アクセント',
    style: { color: '#FFFFFF', backgroundColor: '#0078D4EE', fontSize: 13, borderColor: '#005A9E', borderRadius: 8 },
  },
  {
    id: 'minimal',
    label: 'ミニマル',
    style: { color: '#333333', backgroundColor: '#F5F5F5DD', fontSize: 12, borderColor: 'transparent', borderRadius: 4 },
  },
  {
    id: 'highlight',
    label: 'ハイライト',
    style: { color: '#000000', backgroundColor: '#FFEB3BDD', fontSize: 13, borderColor: '#F9A825', borderRadius: 6 },
  },
];

export const DEFAULT_DESCRIPTION_STYLE: DescriptionStyle = {
  templateId: 'default',
  ...DESCRIPTION_TEMPLATES[0]!.style,
};

// ============================================================
// DemoSettings — デモ設定
// ============================================================

export interface DemoSettings {
  autoStart: boolean;
  showProgress: boolean;
  completionMessage: string;
  allowSkip: boolean;
  defaultDescriptionStyle: DescriptionStyle;
}

// ============================================================
// デフォルト値ファクトリ
// ============================================================

export const DEFAULT_DEMO_SETTINGS: DemoSettings = {
  autoStart: true,
  showProgress: true,
  completionMessage: 'お疲れ様でした！デモが完了しました。',
  allowSkip: false,
  defaultDescriptionStyle: { ...DEFAULT_DESCRIPTION_STYLE },
};

export function createDefaultProject(partial: {
  video: VideoInfo;
  title?: string;
  demoNumber?: number;
}): Omit<DemoProject, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    demoNumber: partial.demoNumber ?? 0,
    title: partial.title ?? '無題のデモ',
    description: '',
    video: partial.video,
    clickPoints: [],
    settings: { ...DEFAULT_DEMO_SETTINGS },
    version: 1,
  };
}

// ============================================================
// プレーヤー状態
// ============================================================

export type PlayerState = 'INIT' | 'PLAYING' | 'WAITING' | 'COMPLETE';

export interface DemoGroup {
  id: string;
  name: string;
  color?: string; // バッジ背景色 (例: "#0078D4")
  createdAt: string;
  updatedAt: string;
}

export interface DemoCreator {
  id: string;
  name: string;
  groupId?: string;
  color?: string; // バッジ背景色 (例: "#0078D4")
  language: 'ja' | 'en';
  role: 'viewer' | 'designer';
  email?: string;
  designerApplicationStatus?: 'pending' | 'approved' | 'rejected';
  designerApplicationDate?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// ソーシャル機能
// ============================================================

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
