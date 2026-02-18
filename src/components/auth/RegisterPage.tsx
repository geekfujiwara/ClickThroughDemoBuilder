/**
 * RegisterPage — 新規アカウント作成画面（英語表示）
 * @microsoft.com のみ登録可。確認メールを送信する。
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Input,
  Label,
  MessageBar,
  MessageBarBody,
  Select,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { ArrowLeftRegular, MailRegular } from '@fluentui/react-icons';
import AppSymbol from '@/components/common/AppSymbol';
import * as authService from '@/services/authService';
import { apiGet } from '@/services/apiClient';
import type { DemoGroup } from '@/types';

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: tokens.colorNeutralBackground3,
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingVerticalXL}`,
  },
  card: {
    width: '100%',
    maxWidth: '460px',
    background: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow16,
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  appName: {
    color: tokens.colorBrandForeground1,
    flex: 1,
    textAlign: 'center',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  hint: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    marginTop: '2px',
  },
  success: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    alignItems: 'center',
    textAlign: 'center',
    padding: tokens.spacingVerticalL,
  },
  checkIcon: {
    fontSize: '48px',
    color: tokens.colorStatusSuccessForeground1,
  },
});

export default function RegisterPage() {
  const styles = useStyles();
  const navigate = useNavigate();

  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState<'en' | 'ja'>('en');
  const [groupId, setGroupId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentEmail, setSentEmail] = useState<string | null>(null);

  useEffect(() => {
    apiGet<DemoGroup[]>('/groups')
      .then((g) => setGroups(g))
      .catch(() => setGroups([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimEmail = email.trim().toLowerCase();
    if (!trimEmail.endsWith('@microsoft.com')) {
      setError('Only @microsoft.com email addresses are allowed.');
      return;
    }
    if (!name.trim()) { setError('Display name is required.'); return; }
    if (!password) { setError('Password is required.'); return; }

    setLoading(true);
    try {
      await authService.register({
        email: trimEmail,
        name: name.trim(),
        password,
        language,
        groupId: groupId || undefined,
      });
      setSentEmail(trimEmail);
    } catch (err) {
      setError((err as Error).message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 送信後の成功画面
  if (sentEmail) {
    return (
      <div className={styles.root}>
        <div className={styles.card}>
          <div className={styles.topBar}>
            <AppSymbol size={28} />
            <Text size={400} weight="semibold" className={styles.appName}>
              Click Through Demo Builder
            </Text>
          </div>
          <div className={styles.success}>
            <Text className={styles.checkIcon}>✉️</Text>
            <Text as="h2" size={500} weight="semibold">Check your email</Text>
            <Text>
              We've sent a verification link to <strong>{sentEmail}</strong>.
              Click the link in the email to complete your account registration.
            </Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              The link expires in 24 hours. If you don't see the email, check your spam folder.
            </Text>
            <Button appearance="subtle" onClick={() => navigate('/login')}>
              Back to Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        {/* Top bar */}
        <div className={styles.topBar}>
          <Button
            appearance="subtle"
            size="small"
            icon={<ArrowLeftRegular />}
            onClick={() => navigate('/login')}
          >
            Back
          </Button>
          <AppSymbol size={28} />
          <Text size={400} weight="semibold" className={styles.appName}>
            Click Through Demo Builder
          </Text>
        </div>

        <Text as="h1" size={600} weight="semibold">Create a new account</Text>
        <Text size={300} style={{ color: tokens.colorNeutralForeground3, marginTop: `-${tokens.spacingVerticalM}` }}>
          Use your @microsoft.com email address to register.
        </Text>

        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM }}>
          {/* Email */}
          <div className={styles.field}>
            <Label htmlFor="reg-email">Account Email Address <span style={{ color: tokens.colorStatusDangerForeground1 }}>*</span></Label>
            <Input
              id="reg-email"
              type="email"
              value={email}
              onChange={(_, d) => setEmail(d.value)}
              placeholder="user@microsoft.com"
              contentBefore={<MailRegular />}
              autoFocus
              required
            />
            <Text className={styles.hint}>Only @microsoft.com addresses are accepted.</Text>
          </div>

          {/* Display Name */}
          <div className={styles.field}>
            <Label htmlFor="reg-name">Display Name <span style={{ color: tokens.colorStatusDangerForeground1 }}>*</span></Label>
            <Input
              id="reg-name"
              value={name}
              onChange={(_, d) => setName(d.value)}
              placeholder="Your name"
              required
            />
          </div>

          {/* Password */}
          <div className={styles.field}>
            <Label htmlFor="reg-password">Password <span style={{ color: tokens.colorStatusDangerForeground1 }}>*</span></Label>
            <Input
              id="reg-password"
              type="password"
              value={password}
              onChange={(_, d) => setPassword(d.value)}
              placeholder="Create a password"
              required
            />
          </div>

          {/* Default Language */}
          <div className={styles.field}>
            <Label htmlFor="reg-lang">Default Language</Label>
            <Select id="reg-lang" value={language} onChange={(_, d) => setLanguage(d.value === 'ja' ? 'ja' : 'en')}>
              <option value="en">English</option>
              <option value="ja">日本語 (Japanese)</option>
            </Select>
          </div>

          {/* Group */}
          <div className={styles.field}>
            <Label htmlFor="reg-group">Organization (optional)</Label>
            <Select id="reg-group" value={groupId} onChange={(_, d) => setGroupId(d.value)}>
              <option value="">— Select organization —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
            <Text className={styles.hint}>You can set this later in your profile.</Text>
          </div>

          {error && (
            <MessageBar intent="error">
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          )}

          <Button
            appearance="primary"
            type="submit"
            disabled={loading || !email.trim() || !name.trim() || !password}
            style={{ marginTop: tokens.spacingVerticalS }}
          >
            {loading ? (
              <Spinner size="tiny" label="Sending verification email..." />
            ) : (
              'Verify Email Address'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
