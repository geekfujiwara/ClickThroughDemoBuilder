/**
 * UserMasterPage — グループ（組織）と作成者（ユーザー）の統合管理ページ
 * - creator は自分のレコードのみ編集可（designer ロールは全件編集可）
 * - email は @microsoft.com のみ設定可
 * - パスワードリセットで新パスワードをポップアップ表示
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  Label,
  Select,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import type { DemoCreator, DemoGroup } from '@/types';
import * as groupService from '@/services/groupService';
import * as creatorService from '@/services/creatorService';
import { useAuthStore } from '@/stores/authStore';
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
  input: { minWidth: '180px' },
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
  rowName: { flex: '1 1 160px' },
  badge: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    background: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusSmall,
    padding: '2px 6px',
  },
  disabledRow: { opacity: 0.5, pointerEvents: 'none' },
  newPasswordBox: {
    fontFamily: 'monospace',
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    letterSpacing: '0.1em',
    color: tokens.colorBrandForeground1,
    background: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    padding: '8px 16px',
    textAlign: 'center',
  },
});

interface CreatorEdit {
  name: string;
  groupId: string;
  language: 'ja' | 'en';
  email: string;
  password: string;
}

export default function UserMasterPage() {
  const styles = useStyles();
  const MSG = useMsg();
  const { role, selectedCreator } = useAuthStore();

  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [creators, setCreators] = useState<DemoCreator[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Group form
  const [newGroupName, setNewGroupName] = useState('');
  const [groupEdits, setGroupEdits] = useState<Record<string, string>>({});

  // Creator form
  const [newCreatorName, setNewCreatorName] = useState('');
  const [newCreatorGroupId, setNewCreatorGroupId] = useState('');
  const [newCreatorLang, setNewCreatorLang] = useState<'ja' | 'en'>('ja');
  const [newCreatorPassword, setNewCreatorPassword] = useState('');
  const [creatorEdits, setCreatorEdits] = useState<Record<string, CreatorEdit>>({});

  // Reset password dialog
  const [resetResult, setResetResult] = useState<{ name: string; newPassword: string } | null>(null);

  const isDesigner = role === 'designer';

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allGroups, allCreators] = await Promise.all([
        groupService.getAllGroups(),
        creatorService.getAllCreators(),
      ]);
      setGroups(allGroups);
      setCreators(allCreators);
      const ge: Record<string, string> = {};
      for (const g of allGroups) ge[g.id] = g.name;
      setGroupEdits(ge);
      const ce: Record<string, CreatorEdit> = {};
      for (const c of allCreators) {
        ce[c.id] = { name: c.name, groupId: c.groupId ?? '', language: c.language, email: c.email ?? '', password: '' };
      }
      setCreatorEdits(ce);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Group CRUD (designer only) ──────────────────────────────
  const handleCreateGroup = useCallback(async () => {
    const name = newGroupName.trim();
    if (!name) return;
    try {
      await groupService.createGroup(name);
      setNewGroupName('');
      await load();
    } catch (e) { alert((e as Error).message); }
  }, [newGroupName, load]);

  const handleSaveGroup = useCallback(async (id: string) => {
    const name = (groupEdits[id] ?? '').trim();
    if (!name) return;
    try {
      await groupService.updateGroup(id, name);
      await load();
    } catch (e) { alert((e as Error).message); }
  }, [groupEdits, load]);

  const handleDeleteGroup = useCallback(async (group: DemoGroup) => {
    if (!confirm(MSG.projectsGroupDeleteConfirm(group.name))) return;
    try {
      await groupService.deleteGroup(group.id);
      await load();
    } catch (e) { alert((e as Error).message); }
  }, [MSG, load]);

  // ── Creator CRUD ────────────────────────────────────────────
  const canEdit = useCallback((creatorId: string) => {
    return isDesigner || selectedCreator?.id === creatorId;
  }, [isDesigner, selectedCreator]);

  const handleCreateCreator = useCallback(async () => {
    const name = newCreatorName.trim();
    if (!name) return;
    try {
      await creatorService.createCreator({
        name,
        groupId: newCreatorGroupId || undefined,
        language: newCreatorLang,
        password: newCreatorPassword.trim() || undefined,
      });
      setNewCreatorName('');
      setNewCreatorGroupId('');
      setNewCreatorLang('ja');
      setNewCreatorPassword('');
      await load();
    } catch (e) { alert((e as Error).message); }
  }, [newCreatorName, newCreatorGroupId, newCreatorLang, newCreatorPassword, load]);

  const handleSaveCreator = useCallback(async (id: string) => {
    if (!canEdit(id)) return;
    const edit = creatorEdits[id];
    if (!edit?.name.trim()) return;
    // email validation (client side)
    if (edit.email && !edit.email.toLowerCase().endsWith('@microsoft.com')) {
      alert('Email must be a @microsoft.com address.');
      return;
    }
    try {
      await creatorService.updateCreator(id, {
        name: edit.name.trim(),
        groupId: edit.groupId || undefined,
        language: edit.language,
        email: edit.email.trim() || undefined,
        password: edit.password.trim() || undefined,
      });
      setCreatorEdits((prev) => ({ ...prev, [id]: { ...edit, password: '' } }));
      await load();
    } catch (e) { alert((e as Error).message); }
  }, [canEdit, creatorEdits, load]);

  const handleResetPassword = useCallback(async (creator: DemoCreator) => {
    if (!canEdit(creator.id)) return;
    if (!confirm(`Reset password for "${creator.name}"? A new random password will be generated.`)) return;
    try {
      const result = await creatorService.resetCreatorPassword(creator.id);
      setResetResult({ name: creator.name, newPassword: result.newPassword });
      await load();
    } catch (e) { alert((e as Error).message); }
  }, [canEdit, load]);

  const handleDeleteCreator = useCallback(async (creator: DemoCreator) => {
    if (!isDesigner) return;
    if (!confirm(MSG.projectsCreatorDeleteConfirm(creator.name))) return;
    try {
      await creatorService.deleteCreator(creator.id);
      await load();
    } catch (e) { alert((e as Error).message); }
  }, [isDesigner, MSG, load]);

  if (isLoading) return <Spinner label="Loading..." />;

  return (
    <div className={styles.page}>
      <Text as="h1" size={700} weight="semibold">{MSG.userMasterTitle}</Text>

      {/* ── Organization section (designer only) ── */}
      {isDesigner && (
        <section className={styles.section}>
          <Text as="h2" size={500} weight="semibold" className={styles.sectionTitle}>
            {MSG.organizationMasterTitle}
          </Text>
          <div className={styles.createRow}>
            <div className={styles.field}>
              <Label>{MSG.projectsGroupNamePlaceholder}</Label>
              <Input className={styles.input} value={newGroupName} onChange={(_, d) => setNewGroupName(d.value)} placeholder={MSG.projectsGroupNamePlaceholder} />
            </div>
            <Button appearance="primary" disabled={!newGroupName.trim()} onClick={handleCreateGroup}>{MSG.projectsGroupCreate}</Button>
          </div>
          <div className={styles.list}>
            {groups.length === 0
              ? <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>No organizations yet.</Text>
              : groups.map((g) => (
                <div key={g.id} className={styles.row}>
                  <Input className={styles.rowName} value={groupEdits[g.id] ?? g.name} onChange={(_, d) => setGroupEdits((prev) => ({ ...prev, [g.id]: d.value }))} />
                  <Button size="small" onClick={() => handleSaveGroup(g.id)}>{MSG.projectsGroupSave}</Button>
                  <Button size="small" appearance="subtle" onClick={() => handleDeleteGroup(g)}>{MSG.delete}</Button>
                </div>
              ))
            }
          </div>
        </section>
      )}

      {/* ── Creator section ── */}
      <section className={styles.section}>
        <Text as="h2" size={500} weight="semibold" className={styles.sectionTitle}>
          {MSG.creatorMasterTitle}
          {!isDesigner && <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginLeft: 8 }}>(You can only edit your own record)</Text>}
        </Text>

        {/* Create row: designer only */}
        {isDesigner && (
          <div className={styles.createRow}>
            <div className={styles.field}>
              <Label>Name</Label>
              <Input className={styles.input} value={newCreatorName} onChange={(_, d) => setNewCreatorName(d.value)} placeholder="User name" />
            </div>
            <div className={styles.field}>
              <Label>{MSG.creatorGroup}</Label>
              <Select value={newCreatorGroupId} onChange={(_, d) => setNewCreatorGroupId(d.value)}>
                <option value="">{MSG.projectsNoGroup}</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            </div>
            <div className={styles.field}>
              <Label>{MSG.creatorLanguage}</Label>
              <Select value={newCreatorLang} onChange={(_, d) => setNewCreatorLang(d.value === 'en' ? 'en' : 'ja')}>
                <option value="ja">{MSG.languageJapanese}</option>
                <option value="en">{MSG.languageEnglish}</option>
              </Select>
            </div>
            <div className={styles.field}>
              <Label>Password (optional)</Label>
              <Input type="password" value={newCreatorPassword} onChange={(_, d) => setNewCreatorPassword(d.value)} placeholder="Leave blank for none" />
            </div>
            <Button appearance="primary" disabled={!newCreatorName.trim()} onClick={handleCreateCreator}>{MSG.projectsCreatorCreate}</Button>
          </div>
        )}

        {/* List */}
        <div className={styles.list}>
          {creators.length === 0
            ? <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>No creators yet.</Text>
            : creators.map((c) => {
              const edit = creatorEdits[c.id] ?? { name: c.name, groupId: c.groupId ?? '', language: c.language, email: c.email ?? '', password: '' };
              const editable = canEdit(c.id);
              const groupName = groups.find((g) => g.id === c.groupId)?.name;
              return (
                <div key={c.id} className={`${styles.row}${editable ? '' : ` ${styles.disabledRow}`}`}>
                  {/* Name */}
                  <Input
                    className={styles.rowName}
                    value={edit.name}
                    readOnly={!editable}
                    onChange={(_, d) => editable && setCreatorEdits((prev) => ({ ...prev, [c.id]: { ...edit, name: d.value } }))}
                  />
                  {/* Group (designer only) */}
                  {isDesigner && (
                    <Select value={edit.groupId} onChange={(_, d) => setCreatorEdits((prev) => ({ ...prev, [c.id]: { ...edit, groupId: d.value } }))}>
                      <option value="">{MSG.projectsNoGroup}</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </Select>
                  )}
                  {/* Language */}
                  <Select
                    value={edit.language}
                    disabled={!editable}
                    onChange={(_, d) => editable && setCreatorEdits((prev) => ({ ...prev, [c.id]: { ...edit, language: d.value === 'en' ? 'en' : 'ja' } }))}
                  >
                    <option value="ja">{MSG.languageJapanese}</option>
                    <option value="en">{MSG.languageEnglish}</option>
                  </Select>
                  {/* Email (@microsoft.com) */}
                  <Input
                    style={{ minWidth: '200px' }}
                    type="email"
                    value={edit.email}
                    readOnly={!editable}
                    placeholder="user@microsoft.com"
                    onChange={(_, d) => editable && setCreatorEdits((prev) => ({ ...prev, [c.id]: { ...edit, email: d.value } }))}
                  />
                  {/* New password */}
                  <Input
                    type="password"
                    style={{ minWidth: '130px' }}
                    value={edit.password}
                    readOnly={!editable}
                    placeholder={c.hasPassword ? 'Change password' : 'Set password'}
                    onChange={(_, d) => editable && setCreatorEdits((prev) => ({ ...prev, [c.id]: { ...edit, password: d.value } }))}
                  />
                  {/* Badges */}
                  {groupName && !isDesigner && <span className={styles.badge}>{groupName}</span>}
                  {c.hasPassword && <span className={styles.badge} title="Password set">🔒</span>}
                  {/* Actions */}
                  {editable && (
                    <>
                      <Button size="small" onClick={() => handleSaveCreator(c.id)}>{MSG.save}</Button>
                      <Button size="small" appearance="outline" onClick={() => handleResetPassword(c)}>Reset PW</Button>
                    </>
                  )}
                  {isDesigner && (
                    <Button size="small" appearance="subtle" onClick={() => handleDeleteCreator(c)}>{MSG.delete}</Button>
                  )}
                </div>
              );
            })
          }
        </div>
      </section>

      {/* Reset password result dialog */}
      <Dialog open={!!resetResult} onOpenChange={() => setResetResult(null)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Password Reset</DialogTitle>
            <DialogContent>
              <Text block style={{ marginBottom: 12 }}>
                New password for <strong>{resetResult?.name}</strong>:
              </Text>
              <div className={styles.newPasswordBox}>{resetResult?.newPassword}</div>
              <Text block size={200} style={{ marginTop: 8, color: tokens.colorNeutralForeground3 }}>
                Please share this password securely. It will not be shown again.
              </Text>
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => setResetResult(null)}>Close</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
