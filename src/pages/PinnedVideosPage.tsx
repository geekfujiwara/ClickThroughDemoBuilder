/**
 * PinnedVideosPage — ホームのピン留め動画設定ページ
 * system_admin のみアクセス可能。
 * ここで設定したデモはホーム画面の右カラム（カードギャラリー）に固定表示される。
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Badge,
  Button,
  Dropdown,
  MessageBar,
  MessageBarBody,
  Option,
  Spinner,
  Text,
  makeStyles,
  tokens,
  type SelectionEvents,
  type OptionOnSelectData,
} from '@fluentui/react-components';
import {
  PinRegular,
  AddRegular,
  DeleteRegular,
  ArrowUpRegular,
  ArrowDownRegular,
} from '@fluentui/react-icons';
import { useAuthStore } from '@/stores/authStore';
import type { DemoProject } from '@/types';
import * as adminService from '@/services/adminService';
import * as projectService from '@/services/projectService';
import { useMsg } from '@/hooks/useMsg';

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL, maxWidth: '860px' },
  header: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
  desc: { color: tokens.colorNeutralForeground3 },
  addForm: {
    display: 'flex', alignItems: 'flex-end', gap: tokens.spacingHorizontalM, flexWrap: 'wrap',
    padding: tokens.spacingVerticalL,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '240px' },
  select: { width: '100%' },
  empty: {
    textAlign: 'center', padding: tokens.spacingVerticalXXXL,
    color: tokens.colorNeutralForeground3,
    border: `1px dashed ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  td: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    verticalAlign: 'middle',
  },
  actions: { display: 'flex', gap: tokens.spacingHorizontalXS, flexWrap: 'wrap' },
  dim: { color: tokens.colorNeutralForeground4 },
});

export default function PinnedVideosPage() {
  const styles = useStyles();
  const MSG = useMsg();
  const { role } = useAuthStore();
  const isSystemAdmin = role === 'system_admin';

  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [allProjects, setAllProjects] = useState<DemoProject[]>([]);
  const [pinnedSelect, setPinnedSelect] = useState<string>('');
  const [operating, setOperating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; intent: 'success' | 'error' } | null>(null);

  const projectMap = useMemo(() => {
    const map = new Map<string, DemoProject>();
    for (const p of allProjects) map.set(p.id, p);
    return map;
  }, [allProjects]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pinnedList, projectList] = await Promise.all([
        adminService.getPinnedDemoIds(),
        projectService.getAllProjects(),
      ]);
      setPinnedIds(pinnedList);
      setAllProjects(projectList);
    } catch (e) {
      setMessage({ text: (e as Error).message, intent: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSystemAdmin) void loadData();
    else setLoading(false);
  }, [isSystemAdmin, loadData]);

  const savePinned = useCallback(async (ids: string[]) => {
    setOperating(true);
    try {
      const updated = await adminService.setPinnedDemoIds(ids);
      setPinnedIds(updated);
      setMessage({ text: MSG.adminPinnedSaved, intent: 'success' });
    } catch (e) {
      setMessage({ text: (e as Error).message, intent: 'error' });
    } finally {
      setOperating(false);
    }
  }, [MSG]);

  const handleAddPinned = useCallback(() => {
    if (!pinnedSelect || pinnedIds.includes(pinnedSelect)) return;
    const next = [...pinnedIds, pinnedSelect];
    setPinnedSelect('');
    void savePinned(next);
  }, [pinnedSelect, pinnedIds, savePinned]);

  const handleRemovePinned = useCallback((id: string) => {
    void savePinned(pinnedIds.filter((p) => p !== id));
  }, [pinnedIds, savePinned]);

  const handleMovePinned = useCallback((index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= pinnedIds.length) return;
    const next = [...pinnedIds];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    void savePinned(next);
  }, [pinnedIds, savePinned]);

  if (!isSystemAdmin) {
    return <Text>{MSG.adminForbidden}</Text>;
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}><Spinner label={MSG.loading} /></div>;
  }

  return (
    <div className={styles.page}>
      <Text as="h1" size={700} weight="semibold" className={styles.header}>
        <PinRegular /> {MSG.adminPinnedTitle}
      </Text>
      <Text size={300} className={styles.desc}>{MSG.adminPinnedDesc}</Text>

      {message && (
        <MessageBar intent={message.intent}>
          <MessageBarBody>{message.text}</MessageBarBody>
        </MessageBar>
      )}

      {/* 追加フォーム */}
      <div className={styles.addForm}>
        <div className={styles.fieldGroup}>
          <Text size={200} weight="semibold">{MSG.adminPinnedAdd}</Text>
          <Dropdown
            className={styles.select}
            placeholder={MSG.adminPinnedSelectPlaceholder}
            value={pinnedSelect ? (projectMap.get(pinnedSelect)?.title ?? '') : ''}
            selectedOptions={pinnedSelect ? [pinnedSelect] : []}
            onOptionSelect={(_: SelectionEvents, data: OptionOnSelectData) => {
              setPinnedSelect(data.optionValue ?? '');
            }}
          >
            {allProjects
              .filter((p) => !pinnedIds.includes(p.id))
              .map((p) => {
                const label = `${p.demoNumber ? `#${p.demoNumber} ` : ''}${p.title}`;
                return (
                  <Option key={p.id} value={p.id} text={label}>{label}</Option>
                );
              })}
          </Dropdown>
        </div>
        <Button
          appearance="primary"
          icon={operating ? <Spinner size="tiny" /> : <AddRegular />}
          disabled={!pinnedSelect || operating}
          onClick={handleAddPinned}
        >
          {MSG.adminPinnedAdd}
        </Button>
      </div>

      {/* ピン留め一覧 */}
      {pinnedIds.length === 0 ? (
        <div className={styles.empty}>
          <Text>{MSG.adminPinnedEmpty}</Text>
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>{MSG.adminPinnedColOrder}</th>
              <th className={styles.th}>{MSG.adminPinnedColTitle}</th>
              <th className={styles.th}>{MSG.adminPinnedColAction}</th>
            </tr>
          </thead>
          <tbody>
            {pinnedIds.map((id, index) => {
              const project = projectMap.get(id);
              return (
                <tr key={id}>
                  <td className={styles.td}>
                    <Badge appearance="outline" size="small">{index + 1}</Badge>
                  </td>
                  <td className={styles.td}>
                    {project ? (
                      <Text weight="semibold">
                        {project.demoNumber ? `#${project.demoNumber} ` : ''}{project.title}
                      </Text>
                    ) : (
                      <Text size={200} className={styles.dim}>{id}</Text>
                    )}
                  </td>
                  <td className={styles.td}>
                    <div className={styles.actions}>
                      <Button
                        size="small" appearance="subtle" icon={<ArrowUpRegular />}
                        disabled={index === 0 || operating}
                        onClick={() => handleMovePinned(index, -1)}
                      >
                        {MSG.adminPinnedMoveUp}
                      </Button>
                      <Button
                        size="small" appearance="subtle" icon={<ArrowDownRegular />}
                        disabled={index === pinnedIds.length - 1 || operating}
                        onClick={() => handleMovePinned(index, 1)}
                      >
                        {MSG.adminPinnedMoveDown}
                      </Button>
                      <Button
                        size="small" appearance="subtle" icon={<DeleteRegular />}
                        disabled={operating}
                        onClick={() => handleRemovePinned(id)}
                      >
                        {MSG.adminPinnedRemove}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
