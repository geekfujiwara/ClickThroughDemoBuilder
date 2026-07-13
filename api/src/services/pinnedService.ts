/**
 * ピン留めデモサービス
 *
 * system_admin がホーム画面のトップに固定表示するデモ（例: 本アプリの使い方デモ）を管理する。
 */
import * as blob from './blobService.js';

interface PinnedDemosData {
  version: number;
  demoIds: string[];
}

const EMPTY_DATA: PinnedDemosData = { version: 1, demoIds: [] };

async function loadData(): Promise<PinnedDemosData> {
  const json = await blob.getPinnedDemosJson();
  if (!json) return { ...EMPTY_DATA, demoIds: [] };
  try {
    const parsed = JSON.parse(json) as Partial<PinnedDemosData>;
    const demoIds = Array.isArray(parsed.demoIds)
      ? parsed.demoIds.filter((id): id is string => typeof id === 'string')
      : [];
    return { version: 1, demoIds };
  } catch {
    return { ...EMPTY_DATA, demoIds: [] };
  }
}

async function saveData(data: PinnedDemosData): Promise<void> {
  await blob.putPinnedDemosJson(JSON.stringify(data));
}

/** ピン留めされたデモ ID の一覧（表示順）を取得 */
export async function listPinnedIds(): Promise<string[]> {
  const data = await loadData();
  return data.demoIds;
}

/** ピン留めデモ ID の一覧を丸ごと置き換える（追加・削除・並べ替え兼用） */
export async function setPinnedIds(demoIds: string[]): Promise<string[]> {
  // 重複を除去しつつ順序を保持
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of demoIds) {
    if (typeof id === 'string' && id.trim() && !seen.has(id)) {
      seen.add(id);
      unique.push(id);
    }
  }
  await saveData({ version: 1, demoIds: unique });
  return unique;
}
