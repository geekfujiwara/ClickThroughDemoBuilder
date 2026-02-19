/**
 * RegisterPage — 新規アカウント作成画面
 * Microsoft Entra ID SSO 経由で自動登録。
 * @microsoft.com アカウントで初回サインインすると自動的にクリエイターが作成される。
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { ArrowLeftRegular } from '@fluentui/react-icons';
import AppSymbol from '@/components/common/AppSymbol';
import { useAuthStore } from '@/stores/authStore';

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: tokens.colorNeutralBackground3,
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingVerticalXL}`,
  },
  card: {
    width: '100%',
    maxWidth: '420px',
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
  note: {
    background: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalM,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    lineHeight: '1.6',
  },
});

export default function RegisterPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const loginWithEntra = useAuthStore((s) => s.loginWithEntra);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMicrosoftLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithEntra();
      navigate('/');
    } catch (err) {
      setError((err as Error).message || 'Microsoft sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
        <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
          Sign in with your Microsoft account to register automatically.
          Only <strong>@microsoft.com</strong> accounts are allowed.
        </Text>

        {error && (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        {/* Microsoft SSO ボタン */}
        <Button
          appearance="primary"
          size="large"
          disabled={loading}
          onClick={() => void handleMicrosoftLogin()}
          style={{ width: '100%', justifyContent: 'center', gap: tokens.spacingHorizontalS }}
          icon={
            <svg width="20" height="20" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
          }
        >
          {loading
            ? <Spinner size="tiny" label="Signing in..." />
            : 'Sign in with Microsoft'}
        </Button>

        <div className={styles.note}>
          ✓ &nbsp;@microsoft.com アカウントで初回サインインすると、自動的にクリエイターとして登録されます。<br />
          ✓ &nbsp;パスワードの設定は不要です。Microsoftアカウントで認証します。
        </div>
      </div>
    </div>
  );
}
