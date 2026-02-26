/**
 * 信頼済みエイリアスサービス
 *
 * system_admin が登録したエイリアスに一致するユーザーは、
 * ログイン時に申請不要で指定ロールへ自動昇格される。
 */
import type { UserRole } from '../shared/types.js';
import * as blob from './blobService.js';

export interface TrustedAlias {
  alias: string;                        // メールのローカルパート (例: "hfujiwara")
  role: 'designer' | 'user_admin';      // 自動昇格先ロール
  addedAt: string;                      // ISO 8601
}

interface TrustedAliasData {
  version: number;
  aliases: TrustedAlias[];
}

const EMPTY_DATA: TrustedAliasData = { version: 1, aliases: [] };

async function loadData(): Promise<TrustedAliasData> {
  const json = await blob.getTrustedAliasesJson();
  if (!json) return { ...EMPTY_DATA };
  try {
    const parsed = JSON.parse(json) as Partial<TrustedAliasData>;
    const aliases = Array.isArray(parsed.aliases) ? parsed.aliases : [];
    return { version: 1, aliases };
  } catch {
    return { ...EMPTY_DATA };
  }
}

async function saveData(data: TrustedAliasData): Promise<void> {
  await blob.putTrustedAliasesJson(JSON.stringify(data));
}

/** 全エイリアス一覧を取得 */
export async function listAliases(): Promise<TrustedAlias[]> {
  const data = await loadData();
  return data.aliases.sort((a, b) => a.alias.localeCompare(b.alias));
}

/** エイリアスを追加（既存の場合はロールを更新） */
export async function upsertAlias(alias: string, role: 'designer' | 'user_admin'): Promise<TrustedAlias> {
  const normalized = alias.toLowerCase().trim();
  if (!normalized || !/^[a-z0-9._-]+$/i.test(normalized)) {
    throw new Error('無効なエイリアスです。英数字・ドット・ハイフン・アンダースコアのみ使用できます。');
  }

  const data = await loadData();
  const index = data.aliases.findIndex((a) => a.alias === normalized);
  const now = new Date().toISOString();

  if (index >= 0) {
    data.aliases[index] = { ...data.aliases[index]!, role, addedAt: now };
  } else {
    data.aliases.push({ alias: normalized, role, addedAt: now });
  }

  await saveData(data);
  return { alias: normalized, role, addedAt: now };
}

/** エイリアスを削除 */
export async function removeAlias(alias: string): Promise<void> {
  const normalized = alias.toLowerCase().trim();
  const data = await loadData();
  const before = data.aliases.length;
  data.aliases = data.aliases.filter((a) => a.alias !== normalized);
  if (data.aliases.length === before) {
    throw new Error('エイリアスが見つかりません');
  }
  await saveData(data);
}

/** ログイン時: メールアドレスのエイリアス部分が信頼リストに含まれるか確認 */
export async function findByEmail(email: string): Promise<TrustedAlias | null> {
  const localPart = email.split('@')[0]?.toLowerCase().trim();
  if (!localPart) return null;
  const data = await loadData();
  return data.aliases.find((a) => a.alias === localPart) ?? null;
}

/** ロールレベルを返す（比較用） */
export function roleLevel(role: UserRole): number {
  const LEVELS: Record<UserRole, number> = {
    viewer: 0,
    designer: 1,
    user_admin: 2,
    system_admin: 3,
  };
  return LEVELS[role] ?? 0;
}
