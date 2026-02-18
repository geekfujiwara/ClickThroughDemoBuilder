/**
 * AdminLoginPage — デザイナー用ログインページ
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  Button,
  Input,
  Label,
  Title2,
  Body1,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useAuthStore } from '@/stores/authStore';
import AppSymbol from '@/components/common/AppSymbol';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: tokens.colorNeutralBackground2,
    padding: '24px',
    position: 'relative',
  },
  content: {
    width: '100%',
    maxWidth: '440px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  appTitle: {
    textAlign: 'center',
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeHero700,
    lineHeight: tokens.lineHeightHero700,
    backgroundImage: `linear-gradient(100deg, ${tokens.colorBrandForeground1}, ${tokens.colorBrandForeground2})`,
    color: 'transparent',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '0.02em',
  },
  viewerLink: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    textDecoration: 'none',
  },
  card: {
    maxWidth: '400px',
    width: '100%',
    padding: '32px',
  },
  header: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: '24px',
  },
  icon: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: tokens.colorBrandForeground1,
    marginBottom: '12px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  error: {
    marginBottom: '8px',
  },
});

export default function AdminLoginPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setError('');
    setLoading(true);
    try {
      await login('designer', password);
      navigate('/', { replace: true });
    } catch {
      setError('パスワードが正しくありません');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Link to="/viewer/login" className={styles.viewerLink}>
        <Button appearance="subtle" size="small">
          通常ログインへ戻る
        </Button>
      </Link>
      <div className={styles.content}>
        <div className={styles.appTitle}>Click Through Demo Builder</div>
        <Card className={styles.card}>
          <CardHeader
            header={
              <div className={styles.header}>
                <span className={styles.icon}>
                  <AppSymbol size={52} />
                </span>
                <Title2 block>デザイナーログイン</Title2>
                <Body1>デザイナーパスワードを入力してください</Body1>
              </div>
            }
          />
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && (
              <MessageBar intent="error" className={styles.error}>
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
            <div>
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(_, data) => setPassword(data.value)}
                placeholder="パスワードを入力"
                style={{ width: '100%' }}
                autoFocus
              />
            </div>
            <Button type="submit" appearance="primary" disabled={loading || !password.trim()}>
              {loading ? 'ログイン中...' : 'ログイン'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
