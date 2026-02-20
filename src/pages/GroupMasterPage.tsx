/**
 * GroupMasterPage — 組織一覧・管理ページ
 * - 全ユーザーが組織カード一覧を閲覧可能
 * - designer ロールのみ作成・編集・削除可能
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardFooter,
  Body1,
  Caption1,
  Input,
  Label,
  Spinner,
  Text,
  makeStyles,
  tokens,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogBody,
  DialogTrigger,
} from '@fluentui/react-components';
import {
  AddRegular,
  EditRegular,
  DeleteRegular,
  SaveRegular,
  DismissRegular,
} from '@fluentui/react-icons';
import type { DemoGroup } from '@/types';
import * as groupService from '@/services/groupService';
import { useAuthStore } from '@/stores/authStore';
import { useMsg } from '@/hooks/useMsg';

const DEFAULT_COLORS = [
  '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#F44336',
  '#00BCD4', '#FF5722', '#607D8B', '#795548', '#3F51B5',
];

function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 128;
}

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXL },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  card: {
    transition: 'box-shadow 200ms ease',
    overflow: 'hidden',
    ':hover': { boxShadow: tokens.shadow8 },
  },
  colorBand: { height: '8px', width: '100%' },
  editForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM} ${tokens.spacingVerticalM}`,
  },
  field: { display: 'flex', flexDirection: 'column', gap: '4px' },
  colorPickerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
    marginTop: '4px',
  },
  colorSwatch: {
    width: '22px',
    height: '22px',
    borderRadius: tokens.borderRadiusSmall,
    border: `2px solid transparent`,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'transform 100ms ease',
    ':hover': { transform: 'scale(1.15)' },
  },
  selectedSwatch: {
    border: `2px solid ${tokens.colorBrandBackground}`,
    boxShadow: tokens.shadow4,
  },
  colorInputWrapper: {
    position: 'relative',
    width: '26px',
    height: '26px',
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusSmall,
    border: `1px dashed ${tokens.colorNeutralStroke1}`,
    cursor: 'pointer',
    flexShrink: 0,
  },
  editActions: { display: 'flex', gap: tokens.spacingHorizontalXS, marginTop: tokens.spacingVerticalXS },
  emptyText: { color: tokens.colorNeutralForeground3 },
  dialogForm: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM, minWidth: '320px' },
  preview: { marginTop: tokens.spacingVerticalXS },
});

interface EditState { name: string; color: string; }

function ColorPickerRow({
  color, onChange,
}: { color: string; onChange: (c: string) => void }) {
  const styles = useStyles();
  return (
    <div className={styles.colorPickerRow}>
      {DEFAULT_COLORS.map((c) => (
        <div
          key={c}
          className={`${styles.colorSwatch} ${color === c ? styles.selectedSwatch : ''}`}
          style={{ backgroundColor: c }}
          onClick={() => onChange(c)}
          title={c}
        />
      ))}
      <div className={styles.colorInputWrapper} title="カスタムカラー">
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          style={{ position: 'absolute', inset: '-4px', width: '40px', height: '40px', cursor: 'pointer', border: 'none', padding: 0 }}
        />
      </div>
    </div>
  );
}

export default function GroupMasterPage() {
  const styles = useStyles();
  const MSG = useMsg();
  const { role } = useAuthStore();
  const isDesigner = role === 'designer';

  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: '', color: DEFAULT_COLORS[0]! });
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0]!);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setGroups(await groupService.getAllGroups());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const startEdit = (group: DemoGroup) => {
    setEditingId(group.id);
    setEditState({ name: group.name, color: group.color ?? DEFAULT_COLORS[0]! });
  };

  const handleSave = useCallback(async (id: string) => {
    const name = editState.name.trim();
    if (!name) return;
    setSaving(true);
    try {
      await groupService.updateGroup(id, { name, color: editState.color });
      setEditingId(null);
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [editState, load]);

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      await groupService.createGroup(name, newColor);
      setCreateOpen(false);
      setNewName('');
      setNewColor(DEFAULT_COLORS[0]!);
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [newName, newColor, load]);

  const handleDelete = useCallback(async (group: DemoGroup) => {
    if (!confirm(MSG.projectsGroupDeleteConfirm(group.name))) return;
    try {
      await groupService.deleteGroup(group.id);
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  }, [MSG, load]);

  if (isLoading) return <Spinner label="Loading..." />;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Text as="h1" size={700} weight="semibold">{MSG.organizationMasterTitle}</Text>
        {isDesigner && (
          <Button appearance="primary" icon={<AddRegular />} onClick={() => setCreateOpen(true)}>
            {MSG.organizationNew}
          </Button>
        )}
      </div>

      {groups.length === 0 ? (
        <Text size={300} className={styles.emptyText}>{MSG.organizationNoGroups}</Text>
      ) : (
        <div className={styles.grid}>
          {groups.map((group) => {
            const bg = group.color ?? '#e0e0e0';
            const textColor = isLightColor(bg) ? '#111' : '#fff';
            const isEditing = editingId === group.id;

            return (
              <Card key={group.id} className={styles.card}>
                <div className={styles.colorBand} style={{ backgroundColor: bg }} />

                {isEditing ? (
                  <div className={styles.editForm}>
                    <div className={styles.field}>
                      <Label>組織名</Label>
                      <Input
                        value={editState.name}
                        onChange={(_, d) => setEditState((p) => ({ ...p, name: d.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(group.id); if (e.key === 'Escape') setEditingId(null); }}
                        autoFocus
                      />
                    </div>
                    <div className={styles.field}>
                      <Label>{MSG.organizationColorLabel}</Label>
                      <ColorPickerRow
                        color={editState.color}
                        onChange={(c) => setEditState((p) => ({ ...p, color: c }))}
                      />
                      <div className={styles.preview}>
                        <span style={{ display: 'inline-block', backgroundColor: editState.color, color: isLightColor(editState.color) ? '#111' : '#fff', borderRadius: '4px', padding: '2px 10px', fontSize: '12px', fontWeight: 600 }}>
                          {editState.name || group.name}
                        </span>
                      </div>
                    </div>
                    <div className={styles.editActions}>
                      <Button size="small" appearance="primary" icon={<SaveRegular />} disabled={saving || !editState.name.trim()} onClick={() => void handleSave(group.id)}>
                        保存
                      </Button>
                      <Button size="small" appearance="subtle" icon={<DismissRegular />} onClick={() => setEditingId(null)}>
                        キャンセル
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <CardHeader
                      header={<Body1><strong>{group.name}</strong></Body1>}
                      description={
                        <Caption1>
                          <span style={{ display: 'inline-block', backgroundColor: bg, color: textColor, borderRadius: '4px', padding: '1px 8px', fontSize: '11px' }}>
                            バッジカラー
                          </span>
                        </Caption1>
                      }
                    />
                    {isDesigner && (
                      <CardFooter>
                        <Button icon={<EditRegular />} size="small" appearance="subtle" onClick={() => startEdit(group)}>
                          編集
                        </Button>
                        <Button icon={<DeleteRegular />} size="small" appearance="subtle" onClick={() => void handleDelete(group)}>
                          削除
                        </Button>
                      </CardFooter>
                    )}
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* 新規作成ダイアログ */}
      <Dialog
        open={createOpen}
        onOpenChange={(_, d) => {
          if (!d.open) { setCreateOpen(false); setNewName(''); setNewColor(DEFAULT_COLORS[0]!); }
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>新しい組織を作成</DialogTitle>
            <DialogContent>
              <div className={styles.dialogForm}>
                <div className={styles.field}>
                  <Label>組織名</Label>
                  <Input
                    value={newName}
                    onChange={(_, d) => setNewName(d.value)}
                    placeholder="組織名を入力"
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }}
                    autoFocus
                  />
                </div>
                <div className={styles.field}>
                  <Label>{MSG.organizationColorLabel}</Label>
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{MSG.organizationColorHint}</Caption1>
                  <ColorPickerRow color={newColor} onChange={setNewColor} />
                  <div className={styles.preview}>
                    <span style={{ display: 'inline-block', backgroundColor: newColor, color: isLightColor(newColor) ? '#111' : '#fff', borderRadius: '4px', padding: '2px 10px', fontSize: '12px', fontWeight: 600 }}>
                      {newName || '組織名'}
                    </span>
                  </div>
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">キャンセル</Button>
              </DialogTrigger>
              <Button appearance="primary" disabled={saving || !newName.trim()} onClick={() => void handleCreate()}>
                {saving ? <Spinner size="tiny" /> : '作成'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

