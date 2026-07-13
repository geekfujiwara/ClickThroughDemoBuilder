/**
 * UserManagementPage — ユーザー管理ページ
 * system_admin / user_admin のみアクセス可能
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button,
  Badge,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Tab,
  TabList,
  Text,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogTrigger,
  Dropdown,
  Option,
  makeStyles,
  tokens,
  type SelectionEvents,
  type OptionOnSelectData,
} from '@fluentui/react-components';
import {
  PersonRegular,
  ShieldKeyholeRegular,
  SearchRegular,
  CheckmarkRegular,
  DismissRegular,
  LockClosedRegular,
  LockOpenRegular,
  BuildingRegular,
  AddRegular,
  DeleteRegular,
  KeyResetRegular,
  PinRegular,
  ArrowUpRegular,
  ArrowDownRegular,
} from '@fluentui/react-icons';
import { useAuthStore } from '@/stores/authStore';
import type { DemoCreator, DemoGroup, DemoProject, TrustedAlias } from '@/types';
import type { UserRole } from '@/services/authService';
import * as adminService from '@/services/adminService';
import * as groupService from '@/services/groupService';
import * as projectService from '@/services/projectService';
import { useMsg } from '@/hooks/useMsg';

const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  searchBar: {
    maxWidth: '320px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `2px solid ${tokens.colorNeutralStroke1}`,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  td: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    verticalAlign: 'middle',
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  applicationCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  applicationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  applicationActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
  reasonText: {
    whiteSpace: 'pre-wrap',
    backgroundColor: tokens.colorNeutralBackground3,
    padding: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusSmall,
    fontSize: tokens.fontSizeBase200,
  },
  empty: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground3,
  },
  roleDropdown: {
    minWidth: '160px',
  },
  // Trusted Aliases tab
  aliasTabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  aliasDescText: {
    color: tokens.colorNeutralForeground2,
  },
  aliasAddForm: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  aliasFieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  aliasInput: {
    minWidth: '220px',
  },
  aliasDimText: {
    color: tokens.colorNeutralForeground3,
  },
  pinnedAddForm: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  pinnedSelect: {
    minWidth: '320px',
  },
});

function getRoleLabels(MSG: ReturnType<typeof useMsg>) {
  return {
    viewer: MSG.adminRoleViewer,
    designer: MSG.adminRoleDesigner,
    user_admin: MSG.adminRoleUserAdmin,
    system_admin: MSG.adminRoleSystemAdmin,
  };
}

function RoleBadge({ role, isBlocked }: { role: UserRole; isBlocked?: boolean }) {
  const MSG = useMsg();
  const labels = getRoleLabels(MSG);
  if (isBlocked) {
    return <Badge appearance="filled" color="danger" size="small">{MSG.adminBlocked}</Badge>;
  }
  const colorMap: Record<UserRole, 'informative' | 'success' | 'warning' | 'danger'> = {
    viewer: 'informative',
    designer: 'success',
    user_admin: 'warning',
    system_admin: 'danger',
  };
  return <Badge appearance="filled" color={colorMap[role]} size="small">{labels[role]}</Badge>;
}

export default function UserManagementPage() {
  const styles = useStyles();
  const MSG = useMsg();
  const { role: currentUserRole } = useAuthStore();
  const isSystemAdmin = currentUserRole === 'system_admin';

  const [tab, setTab] = useState<'users' | 'applications' | 'trusted-aliases' | 'pinned'>('users');
  const [users, setUsers] = useState<DemoCreator[]>([]);
  const [applications, setApplications] = useState<DemoCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; intent: 'success' | 'error' } | null>(null);
  const [search, setSearch] = useState('');

  // Role change dialog
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<DemoCreator | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('viewer');
  const [operating, setOperating] = useState(false);

  // Trusted aliases (system_admin only)
  const [aliases, setAliases] = useState<TrustedAlias[]>([]);
  const [newAlias, setNewAlias] = useState('');
  const [newAliasRole, setNewAliasRole] = useState<'designer' | 'user_admin'>('user_admin');
  const [aliasOperating, setAliasOperating] = useState(false);

  // Pinned demos (system_admin only)
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [allProjects, setAllProjects] = useState<DemoProject[]>([]);
  const [pinnedSelect, setPinnedSelect] = useState<string>('');
  const [pinnedOperating, setPinnedOperating] = useState(false);

  // Group change dialog
  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupTarget, setGroupTarget] = useState<DemoCreator | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  const roleLabels = useMemo(() => getRoleLabels(MSG), [MSG]);

  /** グループID → グループ名のマッピング */
  const groupMap = useMemo(() => {
    const map = new Map<string, DemoGroup>();
    for (const g of groups) map.set(g.id, g);
    return map;
  }, [groups]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const requests: [
        Promise<DemoCreator[]>,
        Promise<DemoCreator[]>,
        Promise<DemoGroup[]>,
        Promise<TrustedAlias[]>,
        Promise<string[]>,
        Promise<DemoProject[]>,
      ] = [
        adminService.getAdminUsers(),
        adminService.getPendingApplications(),
        groupService.getAllGroups(),
        isSystemAdmin ? adminService.getTrustedAliases() : Promise.resolve([]),
        isSystemAdmin ? adminService.getPinnedDemoIds() : Promise.resolve([]),
        isSystemAdmin ? projectService.getAllProjects() : Promise.resolve([]),
      ];
      const [userList, appList, groupList, aliasList, pinnedList, projectList] = await Promise.all(requests);
      setUsers(userList);
      setApplications(appList);
      setGroups(groupList);
      setAliases(aliasList);
      setPinnedIds(pinnedList);
      setAllProjects(projectList);
    } catch (e) {
      setMessage({ text: (e as Error).message, intent: 'error' });
    } finally {
      setLoading(false);
    }
  }, [isSystemAdmin]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [users, search]);

  const handleChangeRole = useCallback(async () => {
    if (!roleTarget) return;
    setOperating(true);
    try {
      await adminService.changeUserRole(roleTarget.id, selectedRole);
      setMessage({ text: MSG.adminSuccess, intent: 'success' });
      setRoleDialogOpen(false);
      await loadData();
    } catch (e) {
      setMessage({ text: (e as Error).message, intent: 'error' });
    } finally {
      setOperating(false);
    }
  }, [roleTarget, selectedRole, MSG, loadData]);

  const handleBlock = useCallback(async (user: DemoCreator) => {
    const isBlocked = !!user.isBlocked;
    const msg = isBlocked ? MSG.adminConfirmUnblock(user.name) : MSG.adminConfirmBlock(user.name);
    if (!window.confirm(msg)) return;
    try {
      await adminService.setUserBlocked(user.id, !isBlocked);
      setMessage({ text: MSG.adminSuccess, intent: 'success' });
      await loadData();
    } catch (e) {
      setMessage({ text: (e as Error).message, intent: 'error' });
    }
  }, [MSG, loadData]);

  const handleApprove = useCallback(async (app: DemoCreator) => {
    if (!window.confirm(MSG.adminConfirmApprove(app.name))) return;
    try {
      await adminService.approveApplication(app.id);
      setMessage({ text: MSG.adminSuccess, intent: 'success' });
      await loadData();
    } catch (e) {
      setMessage({ text: (e as Error).message, intent: 'error' });
    }
  }, [MSG, loadData]);

  const handleReject = useCallback(async (app: DemoCreator) => {
    if (!window.confirm(MSG.adminConfirmReject(app.name))) return;
    try {
      await adminService.rejectApplication(app.id);
      setMessage({ text: MSG.adminSuccess, intent: 'success' });
      await loadData();
    } catch (e) {
      setMessage({ text: (e as Error).message, intent: 'error' });
    }
  }, [MSG, loadData]);

  const openRoleDialog = (user: DemoCreator) => {
    setRoleTarget(user);
    setSelectedRole(user.role);
    setRoleDialogOpen(true);
  };

  const openGroupDialog = (user: DemoCreator) => {
    setGroupTarget(user);
    setSelectedGroupId(user.groupId ?? '');
    setGroupDialogOpen(true);
  };

  const handleAddAlias = useCallback(async () => {
    const trimmed = newAlias.trim().toLowerCase();
    if (!trimmed) return;
    setAliasOperating(true);
    try {
      await adminService.upsertTrustedAlias(trimmed, newAliasRole);
      setMessage({ text: MSG.adminTrustedAliasAdded, intent: 'success' });
      setNewAlias('');
      const updated = await adminService.getTrustedAliases();
      setAliases(updated);
    } catch (e) {
      setMessage({ text: (e as Error).message, intent: 'error' });
    } finally {
      setAliasOperating(false);
    }
  }, [newAlias, newAliasRole, MSG]);

  const handleDeleteAlias = useCallback(async (alias: string) => {
    if (!window.confirm(MSG.adminConfirmDeleteAlias(alias))) return;
    setAliasOperating(true);
    try {
      await adminService.deleteTrustedAlias(alias);
      setMessage({ text: MSG.adminSuccess, intent: 'success' });
      const updated = await adminService.getTrustedAliases();
      setAliases(updated);
    } catch (e) {
      setMessage({ text: (e as Error).message, intent: 'error' });
    } finally {
      setAliasOperating(false);
    }
  }, [MSG]);

  // Pinned demos --------------------------------------------------------
  const projectMap = useMemo(() => {
    const map = new Map<string, DemoProject>();
    for (const p of allProjects) map.set(p.id, p);
    return map;
  }, [allProjects]);

  const savePinned = useCallback(async (ids: string[]) => {
    setPinnedOperating(true);
    try {
      const updated = await adminService.setPinnedDemoIds(ids);
      setPinnedIds(updated);
      setMessage({ text: MSG.adminPinnedSaved, intent: 'success' });
    } catch (e) {
      setMessage({ text: (e as Error).message, intent: 'error' });
    } finally {
      setPinnedOperating(false);
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


  const handleChangeGroup = useCallback(async () => {
    if (!groupTarget) return;
    setOperating(true);
    try {
      await adminService.changeUserGroup(groupTarget.id, selectedGroupId || null);
      setMessage({ text: MSG.adminSuccess, intent: 'success' });
      setGroupDialogOpen(false);
      await loadData();
    } catch (e) {
      setMessage({ text: (e as Error).message, intent: 'error' });
    } finally {
      setOperating(false);
    }
  }, [groupTarget, selectedGroupId, MSG, loadData]);

  // user_admin が割り当て可能なロール
  const assignableRoles: UserRole[] = isSystemAdmin
    ? ['viewer', 'designer', 'user_admin', 'system_admin']
    : ['viewer', 'designer'];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
        <Spinner size="large" label={MSG.loading} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <ShieldKeyholeRegular fontSize={24} />
        <Text weight="semibold" size={600}>{MSG.adminUserManagement}</Text>
        <Badge appearance="outline" color="important" size="small">
          {isSystemAdmin ? MSG.adminRoleSystemAdmin : MSG.adminRoleUserAdmin}
        </Badge>
      </div>

      {message && (
        <MessageBar intent={message.intent}>
          <MessageBarBody>{message.text}</MessageBarBody>
        </MessageBar>
      )}

      <TabList
        selectedValue={tab}
        onTabSelect={(_, d) => setTab(d.value as 'users' | 'applications' | 'trusted-aliases' | 'pinned')}
      >
        <Tab value="users" icon={<PersonRegular />}>
          {MSG.adminTabUsers} ({users.length})
        </Tab>
        <Tab value="applications" icon={<ShieldKeyholeRegular />}>
          {MSG.adminTabApplications} ({applications.length})
        </Tab>
        {isSystemAdmin && (
          <Tab value="trusted-aliases" icon={<KeyResetRegular />}>
            {MSG.adminTabTrustedAliases} ({aliases.length})
          </Tab>
        )}
        {isSystemAdmin && (
          <Tab value="pinned" icon={<PinRegular />}>
            {MSG.adminTabPinned} ({pinnedIds.length})
          </Tab>
        )}
      </TabList>

      {tab === 'users' && (
        <>
          <Input
            className={styles.searchBar}
            placeholder={MSG.adminSearchUsers}
            contentBefore={<SearchRegular />}
            value={search}
            onChange={(_, d) => setSearch(d.value)}
          />

          {filteredUsers.length === 0 ? (
            <div className={styles.empty}>
              <Text>{MSG.adminNoUsers}</Text>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>名前</th>
                  <th className={styles.th}>メール</th>
                  <th className={styles.th}>組織</th>
                  <th className={styles.th}>権限</th>
                  <th className={styles.th}>状態</th>
                  <th className={styles.th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td className={styles.td}>
                      <Text weight="semibold">{user.name}</Text>
                    </td>
                    <td className={styles.td}>
                      <Text size={200}>{user.email ?? '-'}</Text>
                    </td>
                    <td className={styles.td}>
                      {user.groupId && groupMap.has(user.groupId) ? (
                        <Badge appearance="outline" color="brand" size="small">
                          {groupMap.get(user.groupId)!.name}
                        </Badge>
                      ) : (
                        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                          {MSG.adminGroupNone}
                        </Text>
                      )}
                    </td>
                    <td className={styles.td}>
                      <RoleBadge role={user.role} />
                    </td>
                    <td className={styles.td}>
                      {user.isBlocked && <RoleBadge role={user.role} isBlocked />}
                      {user.designerApplicationStatus === 'pending' && (
                        <Badge appearance="outline" color="warning" size="small">申請中</Badge>
                      )}
                    </td>
                    <td className={styles.td}>
                      <div className={styles.actions}>
                        <Button
                          size="small"
                          appearance="subtle"
                          onClick={() => openRoleDialog(user)}
                        >
                          {MSG.adminChangeRole}
                        </Button>
                        <Button
                          size="small"
                          appearance="subtle"
                          icon={<BuildingRegular />}
                          onClick={() => openGroupDialog(user)}
                        >
                          {MSG.adminChangeGroup}
                        </Button>
                        {isSystemAdmin && (
                          <Button
                            size="small"
                            appearance="subtle"
                            icon={user.isBlocked ? <LockOpenRegular /> : <LockClosedRegular />}
                            onClick={() => void handleBlock(user)}
                          >
                            {user.isBlocked ? MSG.adminUnblock : MSG.adminBlock}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {tab === 'applications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
          {applications.length === 0 ? (
            <div className={styles.empty}>
              <Text>{MSG.adminNoApplications}</Text>
            </div>
          ) : (
            applications.map((app) => (
              <div key={app.id} className={styles.applicationCard}>
                <div className={styles.applicationHeader}>
                  <div>
                    <Text weight="semibold">{app.name}</Text>
                    <Text size={200} style={{ marginLeft: 8 }}>{app.email ?? ''}</Text>
                  </div>
                  <Text size={200}>
                    {MSG.adminApplicationDate}: {app.designerApplicationDate
                      ? new Date(app.designerApplicationDate).toLocaleDateString()
                      : '-'}
                  </Text>
                </div>
                {app.designerApplicationReason && (
                  <div>
                    <Text size={200} weight="semibold">{MSG.adminApplicationReason}:</Text>
                    <div className={styles.reasonText}>{app.designerApplicationReason}</div>
                  </div>
                )}
                <div className={styles.applicationActions}>
                  <Button
                    appearance="primary"
                    size="small"
                    icon={<CheckmarkRegular />}
                    onClick={() => void handleApprove(app)}
                  >
                    {MSG.adminApprove}
                  </Button>
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<DismissRegular />}
                    onClick={() => void handleReject(app)}
                  >
                    {MSG.adminReject}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Trusted Aliases Tab */}
      {tab === 'trusted-aliases' && isSystemAdmin && (
        <div className={styles.aliasTabContent}>
          <Text size={200} className={styles.aliasDescText}>
            {MSG.adminTrustedAliasesDesc}
          </Text>

          {/* Add form */}
          <div className={styles.aliasAddForm}>
            <div className={styles.aliasFieldGroup}>
              <Text size={200} weight="semibold">{MSG.adminTrustedAliasAlias}</Text>
              <Input
                className={styles.aliasInput}
                placeholder={MSG.adminTrustedAliasAliasPlaceholder}
                value={newAlias}
                onChange={(_, d) => setNewAlias(d.value)}
              />
            </div>
            <div className={styles.aliasFieldGroup}>
              <Text size={200} weight="semibold">{MSG.adminTrustedAliasRole}</Text>
              <Dropdown
                className={styles.roleDropdown}
                value={newAliasRole === 'user_admin' ? MSG.adminRoleUserAdmin : MSG.adminRoleDesigner}
                selectedOptions={[newAliasRole]}
                onOptionSelect={(_: SelectionEvents, data: OptionOnSelectData) => {
                  setNewAliasRole(data.optionValue as 'designer' | 'user_admin');
                }}
              >
                <Option value="designer">{MSG.adminRoleDesigner}</Option>
                <Option value="user_admin">{MSG.adminRoleUserAdmin}</Option>
              </Dropdown>
            </div>
            <Button
              appearance="primary"
              icon={aliasOperating ? <Spinner size="tiny" /> : <AddRegular />}
              disabled={!newAlias.trim() || aliasOperating}
              onClick={() => void handleAddAlias()}
            >
              {MSG.adminTrustedAliasAdd}
            </Button>
          </div>

          {/* Alias list */}
          {aliases.length === 0 ? (
            <div className={styles.empty}>
              <Text>{MSG.adminTrustedAliasEmpty}</Text>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>{MSG.adminTrustedAliasAlias}</th>
                  <th className={styles.th}>{MSG.adminTrustedAliasRole}</th>
                  <th className={styles.th}>{MSG.adminTrustedAliasAddedAt}</th>
                  <th className={styles.th}>{MSG.adminTrustedAliasDelete}</th>
                </tr>
              </thead>
              <tbody>
                {aliases.map((a) => (
                  <tr key={a.alias}>
                    <td className={styles.td}>
                      <Text weight="semibold">{a.alias}</Text>
                      <Text size={200} className={styles.aliasDimText}> @microsoft.com</Text>
                    </td>
                    <td className={styles.td}>
                      <Badge
                        appearance="filled"
                        color={a.role === 'user_admin' ? 'warning' : 'success'}
                        size="small"
                      >
                        {a.role === 'user_admin' ? MSG.adminRoleUserAdmin : MSG.adminRoleDesigner}
                      </Badge>
                    </td>
                    <td className={styles.td}>
                      <Text size={200}>{new Date(a.addedAt).toLocaleDateString()}</Text>
                    </td>
                    <td className={styles.td}>
                      <Button
                        size="small"
                        appearance="subtle"
                        icon={<DeleteRegular />}
                        disabled={aliasOperating}
                        onClick={() => void handleDeleteAlias(a.alias)}
                      >
                        {MSG.adminTrustedAliasDelete}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Pinned Demos Tab */}
      {tab === 'pinned' && isSystemAdmin && (
        <div className={styles.aliasTabContent}>
          <Text size={200} className={styles.aliasDescText}>
            {MSG.adminPinnedDesc}
          </Text>

          {/* Add form */}
          <div className={styles.pinnedAddForm}>
            <div className={styles.aliasFieldGroup}>
              <Text size={200} weight="semibold">{MSG.adminPinnedAdd}</Text>
              <Dropdown
                className={styles.pinnedSelect}
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
                      <Option key={p.id} value={p.id} text={label}>
                        {label}
                      </Option>
                    );
                  })}
              </Dropdown>
            </div>
            <Button
              appearance="primary"
              icon={pinnedOperating ? <Spinner size="tiny" /> : <AddRegular />}
              disabled={!pinnedSelect || pinnedOperating}
              onClick={handleAddPinned}
            >
              {MSG.adminPinnedAdd}
            </Button>
          </div>

          {/* Pinned list */}
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
                          <Text size={200} className={styles.aliasDimText}>{id}</Text>
                        )}
                      </td>
                      <td className={styles.td}>
                        <div className={styles.actions}>
                          <Button
                            size="small"
                            appearance="subtle"
                            icon={<ArrowUpRegular />}
                            disabled={index === 0 || pinnedOperating}
                            onClick={() => handleMovePinned(index, -1)}
                          >
                            {MSG.adminPinnedMoveUp}
                          </Button>
                          <Button
                            size="small"
                            appearance="subtle"
                            icon={<ArrowDownRegular />}
                            disabled={index === pinnedIds.length - 1 || pinnedOperating}
                            onClick={() => handleMovePinned(index, 1)}
                          >
                            {MSG.adminPinnedMoveDown}
                          </Button>
                          <Button
                            size="small"
                            appearance="subtle"
                            icon={<DeleteRegular />}
                            disabled={pinnedOperating}
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
      )}

      {/* Role Change Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={(_, d) => setRoleDialogOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{MSG.adminChangeRole}</DialogTitle>
            <DialogContent>
              {roleTarget && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
                  <Text>
                    <Text weight="semibold">{roleTarget.name}</Text> ({roleTarget.email ?? '-'})
                  </Text>
                  <Dropdown
                    className={styles.roleDropdown}
                    value={roleLabels[selectedRole]}
                    selectedOptions={[selectedRole]}
                    onOptionSelect={(_: SelectionEvents, data: OptionOnSelectData) => {
                      setSelectedRole(data.optionValue as UserRole);
                    }}
                  >
                    {assignableRoles.map((r) => (
                      <Option key={r} value={r}>{roleLabels[r]}</Option>
                    ))}
                  </Dropdown>
                </div>
              )}
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">{MSG.cancel}</Button>
              </DialogTrigger>
              <Button
                appearance="primary"
                disabled={operating || (roleTarget?.role === selectedRole)}
                onClick={() => void handleChangeRole()}
                icon={operating ? <Spinner size="tiny" /> : undefined}
              >
                {MSG.adminChangeRole}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Group Change Dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={(_, d) => setGroupDialogOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{MSG.adminChangeGroup}</DialogTitle>
            <DialogContent>
              {groupTarget && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
                  <Text>
                    <Text weight="semibold">{groupTarget.name}</Text> ({groupTarget.email ?? '-'})
                  </Text>
                  <Dropdown
                    className={styles.roleDropdown}
                    placeholder={MSG.adminGroupNone}
                    value={selectedGroupId ? (groupMap.get(selectedGroupId)?.name ?? '') : MSG.adminGroupNone}
                    selectedOptions={[selectedGroupId]}
                    onOptionSelect={(_: SelectionEvents, data: OptionOnSelectData) => {
                      setSelectedGroupId(data.optionValue ?? '');
                    }}
                  >
                    <Option key="" value="">{MSG.adminGroupNone}</Option>
                    {groups.map((g) => (
                      <Option key={g.id} value={g.id}>{g.name}</Option>
                    ))}
                  </Dropdown>
                </div>
              )}
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary">{MSG.cancel}</Button>
              </DialogTrigger>
              <Button
                appearance="primary"
                disabled={operating || (groupTarget?.groupId ?? '') === selectedGroupId}
                onClick={() => void handleChangeGroup()}
                icon={operating ? <Spinner size="tiny" /> : undefined}
              >
                {MSG.adminChangeGroup}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
