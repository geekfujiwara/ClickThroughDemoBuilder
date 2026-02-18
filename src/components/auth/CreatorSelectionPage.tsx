import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Body1,
  Button,
  Card,
  CardHeader,
  Input,
  Label,
  MessageBar,
  MessageBarBody,
  Select,
  Spinner,
  Title2,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import type { DemoCreator, DemoGroup } from '@/types';
import * as creatorService from '@/services/creatorService';
import * as groupService from '@/services/groupService';
import { useAuthStore } from '@/stores/authStore';
import AppSymbol from '@/components/common/AppSymbol';
import { setCurrentLanguage } from '@/constants/i18n';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    minHeight: '100vh',
    backgroundColor: tokens.colorNeutralBackground2,
    padding: '24px',
  },
  content: {
    width: '100%',
    maxWidth: '640px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  appTitle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    justifyContent: 'center',
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeHero700,
    color: tokens.colorBrandForeground1,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  formRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
});

export default function CreatorSelectionPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const selectCreator = useAuthStore((s) => s.selectCreator);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [creators, setCreators] = useState<DemoCreator[]>([]);
  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState('');

  // パスワード確認ステップ
  const [passwordStep, setPasswordStep] = useState(false);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);

  // 新規作成フォーム
  const [newName, setNewName] = useState('');
  const [newGroupId, setNewGroupId] = useState('');
  const [newLanguage, setNewLanguage] = useState<'ja' | 'en'>('ja');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const selectedCreator = useMemo(
    () => creators.find((c) => c.id === selectedCreatorId) ?? null,
    [creators, selectedCreatorId],
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [allCreators, allGroups] = await Promise.all([
        creatorService.getAllCreators(),
        groupService.getAllGroups(),
      ]);
      setCreators(allCreators);
      setGroups(allGroups);
      if (!selectedCreatorId && allCreators[0]) {
        setSelectedCreatorId(allCreators[0].id);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCreatorId]);

  useEffect(() => {
    setCurrentLanguage('en');
    void loadData();
  }, [loadData]);

  const goNext = useCallback((creator: DemoCreator) => {
    selectCreator(creator);
    navigate(role === 'designer' ? '/' : '/viewer/demos', { replace: true });
  }, [navigate, role, selectCreator]);

  // 「Continue」ボタン: hasPassword があればパスワードステップへ
  const handleContinue = useCallback(() => {
    if (!selectedCreator) return;
    if (selectedCreator.hasPassword) {
      setPasswordStep(true);
      setPassword('');
      setError('');
    } else {
      goNext(selectedCreator);
    }
  }, [selectedCreator, goNext]);

  // パスワード照合
  const handleVerifyPassword = useCallback(async () => {
    if (!selectedCreator) return;
    setVerifying(true);
    setError('');
    try {
      const ok = await creatorService.verifyCreatorPassword(selectedCreator.id, password);
      if (ok) {
        goNext(selectedCreator);
      } else {
        setError('Incorrect password.');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setVerifying(false);
    }
  }, [selectedCreator, password, goNext]);

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError('');
    try {
      const creator = await creatorService.createCreator({
        name,
        groupId: newGroupId || undefined,
        language: newLanguage,
        password: newPassword.trim() || undefined,
      });
      setNewName('');
      setNewGroupId('');
      setNewLanguage('ja');
      setNewPassword('');
      await loadData();
      goNext(creator);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }, [newGroupId, newLanguage, newName, newPassword, loadData, goNext]);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.appTitle}>
          <AppSymbol size={28} />
          Click Through Demo Builder
        </div>

        {/* パスワード入力ステップ */}
        {passwordStep && selectedCreator ? (
          <Card>
            <CardHeader
              header={<Title2>Enter Password</Title2>}
              description={<Body1>A password is required for <strong>{selectedCreator.name}</strong>.</Body1>}
            />
            <div className={styles.section}>
              <div className={styles.formRow}>
                <Label htmlFor="creator-password">Password</Label>
                <Input
                  id="creator-password"
                  type="password"
                  value={password}
                  onChange={(_, d) => setPassword(d.value)}
                  placeholder="Enter password"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleVerifyPassword(); }}
                />
              </div>
              <div className={styles.actions}>
                <Button appearance="subtle" onClick={() => { setPasswordStep(false); setError(''); }}>
                  Back
                </Button>
                <Button appearance="primary" disabled={verifying || !password} onClick={() => void handleVerifyPassword()}>
                  {verifying ? 'Verifying...' : 'Continue'}
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <>
            {/* 既存ユーザー選択 */}
            <Card>
              <CardHeader
                header={<Title2>Select User (Creator)</Title2>}
                description={<Body1>Select an existing creator and continue.</Body1>}
              />
              <div className={styles.section}>
                {isLoading ? (
                  <Spinner label="Loading users..." />
                ) : creators.length === 0 ? (
                  <Body1>No users found. Please create one below.</Body1>
                ) : (
                  <>
                    <div className={styles.formRow}>
                      <Label htmlFor="existing-creator">User</Label>
                      <Select
                        id="existing-creator"
                        value={selectedCreatorId}
                        onChange={(_, data) => setSelectedCreatorId(data.value)}
                      >
                        {creators.map((creator) => (
                          <option key={creator.id} value={creator.id}>
                            {creator.name}{creator.hasPassword ? ' 🔒' : ''}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className={styles.actions}>
                      <Button appearance="primary" disabled={!selectedCreator} onClick={handleContinue}>
                        Continue
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>

            {/* 新規ユーザー作成 */}
            <Card>
              <CardHeader
                header={<Title2>Create User (Creator)</Title2>}
                description={<Body1>If your user does not exist, create a new one.</Body1>}
              />
              <div className={styles.section}>
                <div className={styles.formRow}>
                  <Label htmlFor="new-creator-name">Name</Label>
                  <Input
                    id="new-creator-name"
                    value={newName}
                    onChange={(_, d) => setNewName(d.value)}
                    placeholder="Enter user name"
                  />
                </div>
                <div className={styles.formRow}>
                  <Label htmlFor="new-creator-group">Organization</Label>
                  <Select
                    id="new-creator-group"
                    value={newGroupId}
                    onChange={(_, d) => setNewGroupId(d.value)}
                  >
                    <option value="">(None)</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </Select>
                </div>
                <div className={styles.formRow}>
                  <Label htmlFor="new-creator-lang">Language</Label>
                  <Select
                    id="new-creator-lang"
                    value={newLanguage}
                    onChange={(_, d) => setNewLanguage(d.value === 'en' ? 'en' : 'ja')}
                  >
                    <option value="ja">日本語 (Japanese)</option>
                    <option value="en">English</option>
                  </Select>
                </div>
                <div className={styles.formRow}>
                  <Label htmlFor="new-creator-password">Password (optional)</Label>
                  <Input
                    id="new-creator-password"
                    type="password"
                    value={newPassword}
                    onChange={(_, d) => setNewPassword(d.value)}
                    placeholder="Leave blank for no password"
                  />
                </div>
                <div className={styles.actions}>
                  <Button appearance="primary" disabled={creating || !newName.trim()} onClick={() => void handleCreate()}>
                    {creating ? 'Creating...' : 'Create and Continue'}
                  </Button>
                </div>
              </div>
            </Card>
          </>
        )}

        {error && (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}
      </div>
    </div>
  );
}
