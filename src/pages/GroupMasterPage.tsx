/**
 * GroupMasterPage — グループ（組織）の管理ページ
 * - designer ロールのユーザー（Entra / ローカル両方）が利用可能
 * - グループの作成・名称変更・削除
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Input,
  Label,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import type { DemoGroup } from '@/types';
import * as groupService from '@/services/groupService';
import { useMsg } from '@/hooks/useMsg';

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXL },
  section: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM },
  sectionTitle: {
    paddingBottom: tokens.spacingVerticalS,
    borderBottom: `2px solid ${tokens.colorBrandBackground}`,
    marginBottom: tokens.spacingVerticalS,
  },
  createRow: {
    display: 'flex', gap: tokens.spacingHorizontalS,
    alignItems: 'flex-end', flexWrap: 'wrap',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  input: { minWidth: '200px' },
  list: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS },
  row: {
    display: 'flex', gap: tokens.spacingHorizontalS,
    alignItems: 'center', flexWrap: 'wrap',
    padding: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  rowName: { flex: '1 1 200px' },
  emptyText: { color: tokens.colorNeutralForeground3 },
});

export default function GroupMasterPage() {
  const styles = useStyles();
  const MSG = useMsg();

  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupEdits, setGroupEdits] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const allGroups = await groupService.getAllGroups();
      setGroups(allGroups);
      const ge: Record<string, string> = {};
      for (const g of allGroups) ge[g.id] = g.name;
      setGroupEdits(ge);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = useCallback(async () => {
    const name = newGroupName.trim();
    if (!name) return;
    try {
      await groupService.createGroup(name);
      setNewGroupName('');
      await load();
    } catch (e) { alert((e as Error).message); }
  }, [newGroupName, load]);

  const handleSave = useCallback(async (id: string) => {
    const name = (groupEdits[id] ?? '').trim();
    if (!name) return;
    try {
      await groupService.updateGroup(id, name);
      await load();
    } catch (e) { alert((e as Error).message); }
  }, [groupEdits, load]);

  const handleDelete = useCallback(async (group: DemoGroup) => {
    if (!confirm(MSG.projectsGroupDeleteConfirm(group.name))) return;
    try {
      await groupService.deleteGroup(group.id);
      await load();
    } catch (e) { alert((e as Error).message); }
  }, [MSG, load]);

  if (isLoading) return <Spinner label="Loading..." />;

  return (
    <div className={styles.page}>
      <Text as="h1" size={700} weight="semibold">{MSG.organizationMasterTitle}</Text>

      <section className={styles.section}>
        <Text as="h2" size={500} weight="semibold" className={styles.sectionTitle}>
          {MSG.organizationMasterTitle}
        </Text>

        {/* 新規作成 */}
        <div className={styles.createRow}>
          <div className={styles.field}>
            <Label>{MSG.projectsGroupNamePlaceholder}</Label>
            <Input
              className={styles.input}
              value={newGroupName}
              onChange={(_, d) => setNewGroupName(d.value)}
              placeholder={MSG.projectsGroupNamePlaceholder}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }}
            />
          </div>
          <Button appearance="primary" disabled={!newGroupName.trim()} onClick={() => void handleCreate()}>
            {MSG.projectsGroupCreate}
          </Button>
        </div>

        {/* 一覧 */}
        <div className={styles.list}>
          {groups.length === 0
            ? <Text size={300} className={styles.emptyText}>グループがまだありません。</Text>
            : groups.map((g) => (
              <div key={g.id} className={styles.row}>
                <Input
                  className={styles.rowName}
                  value={groupEdits[g.id] ?? g.name}
                  onChange={(_, d) => setGroupEdits((prev) => ({ ...prev, [g.id]: d.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(g.id); }}
                />
                <Button size="small" onClick={() => void handleSave(g.id)}>
                  {MSG.projectsGroupSave}
                </Button>
                <Button size="small" appearance="subtle" onClick={() => void handleDelete(g)}>
                  {MSG.delete}
                </Button>
              </div>
            ))
          }
        </div>
      </section>
    </div>
  );
}

