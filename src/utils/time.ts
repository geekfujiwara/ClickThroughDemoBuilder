/**
 * 時間フォーマット・パースユーティリティ
 */

/** 秒 → "MM:SS.m" 形式 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(Math.floor(secs)).padStart(2, '0');
  const ms = String(Math.floor((secs % 1) * 10));
  return `${mm}:${ss}.${ms}`;
}

/** "MM:SS.m" → 秒 */
export function parseTime(formatted: string): number | null {
  const match = /^(\d{1,3}):(\d{2})\.(\d)$/.exec(formatted);
  if (!match) return null;
  const [, mm, ss, ms] = match;
  return Number(mm) * 60 + Number(ss) + Number(ms) / 10;
}

/** 秒を小数点以下2桁に丸める */
export function roundTime(seconds: number): number {
  return Math.round(seconds * 100) / 100;
}
