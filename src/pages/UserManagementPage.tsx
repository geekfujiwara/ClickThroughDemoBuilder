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
} from '@fluentui/react-icons';
import { useAuthStore } from '@/stores/authStore';
import type { DemoCreator } from '@/types';
import type { UserRole } from '@/services/authService';
import * as adminService from '@/services/adminService';
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

  const [tab, setTab] = useState<'users' | 'applications'>('users');
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

  const roleLabels = useMemo(() => getRoleLabels(MSG), [MSG]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [userList, appList] = await Promise.all([
        adminService.getAdminUsers(),
        adminService.getPendingApplications(),
      ]);
      setUsers(userList);
      setApplications(appList);
    } catch (e) {
      setMessage({ text: (e as Error).message, intent: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

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
        onTabSelect={(_, d) => setTab(d.value as 'users' | 'applications')}
      >
        <Tab value="users" icon={<PersonRegular />}>
          {MSG.adminTabUsers} ({users.length})
        </Tab>
        <Tab value="applications" icon={<ShieldKeyholeRegular />}>
          {MSG.adminTabApplications} ({applications.length})
        </Tab>
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
    </div>
  );
}
