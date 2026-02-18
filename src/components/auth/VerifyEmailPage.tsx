/**
 * VerifyEmailPage — メール確認リンクから到達するページ
 * URL の ?token= を読んで POST /api/auth/verify → ログイン → / へリダイレクト
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Spinner, Text, makeStyles, tokens } from '@fluentui/react-components';
import AppSymbol from '@/components/common/AppSymbol';
import * as authService from '@/services/authService';
import * as creatorService from '@/services/creatorService';
import { useAuthStore } from '@/stores/authStore';

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: tokens.colorNeutralBackground3,
    padding: tokens.spacingVerticalXL,
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    background: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow16,
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalL,
    textAlign: 'center',
  },
});

type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setVerified } = useAuthStore();

  const [status, setStatus] = useState<Status>('verifying');
  const [errorMsg, setErrorMsg] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setErrorMsg('No verification token found in the URL.');
      setStatus('error');
      return;
    }

    void (async () => {
      try {
        const { role, creatorId, name } = await authService.verifyEmail(token);
        // JWT が Cookie に設定されたのでクリエイター情報を取得して認証状態をセット
        const creator = await creatorService.getCreator(creatorId);
        setVerified(role, creator);
        setUserName(name);
        setStatus('success');
        // 2 秒後にホームへ
        setTimeout(() => navigate('/'), 2000);
      } catch (err) {
        setErrorMsg((err as Error).message || 'Verification failed.');
        setStatus('error');
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <AppSymbol size={48} />
        <Text size={500} weight="semibold" style={{ color: tokens.colorBrandForeground1 }}>
          Click Through Demo Builder
        </Text>

        {status === 'verifying' && (
          <>
            <Spinner size="large" />
            <Text>Verifying your email address…</Text>
          </>
        )}

        {status === 'success' && (
          <>
            <Text style={{ fontSize: '48px' }}>🎉</Text>
            <Text as="h2" size={500} weight="semibold">Welcome, {userName}!</Text>
            <Text>Your account has been verified. Redirecting you to the app…</Text>
          </>
        )}

        {status === 'error' && (
          <>
            <Text style={{ fontSize: '48px' }}>❌</Text>
            <Text as="h2" size={500} weight="semibold">Verification Failed</Text>
            <Text style={{ color: tokens.colorStatusDangerForeground1 }}>{errorMsg}</Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              The link may have expired or already been used. Please register again.
            </Text>
            <Button appearance="primary" onClick={() => navigate('/register')}>
              Register Again
            </Button>
            <Button appearance="subtle" onClick={() => navigate('/login')}>
              Back to Sign In
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
