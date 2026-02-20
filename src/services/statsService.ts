/**
 * デモ統計情報 API クライアント
 */
import { apiGet } from './apiClient';

export interface DailyPlay {
  date: string;
  views: number;
  completions: number;
}

export interface SitePlay {
  site: string;
  count: number;
}

export interface RoleBreakdown {
  role: string;
  count: number;
}

export interface DemoStats {
  demoId: string;
  likeCount: number;
  commentCount: number;
  playCount: number;
  completionCount: number;
  completionRate: number;
  dailyPlays: DailyPlay[];
  topSites: SitePlay[];
  roleBreakdown: RoleBreakdown[];
  byUser: { name: string; count: number }[];
  byOrganization: { name: string; count: number }[];
}

export async function getDemoStats(demoId: string): Promise<DemoStats> {
  return apiGet<DemoStats>(`/demos/${demoId}/stats`);
}
