/**
 * ViewerDemosPage — Viewer 用デモ一覧ページ
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardPreview,
  Button,
  Title2,
  Body1,
  Caption1,
  Spinner,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { PlayRegular, SignOutRegular } from '@fluentui/react-icons';
import { apiGet } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import AppSymbol from '@/components/common/AppSymbol';

interface DemoSummary {
  id: string;
  demoNumber: number;
  title: string;
  description: string;
  thumbnailDataUrl: string;
  clickPointCount: number;
  duration: number;
  updatedAt: string;
}

const useStyles = makeStyles({
  container: {
    minHeight: '100vh',
    backgroundColor: tokens.colorNeutralBackground2,
    padding: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '1200px',
    margin: '0 auto 24px',
  },
  headerTitle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  card: {
    cursor: 'pointer',
    ':hover': {
      boxShadow: tokens.shadow8,
    },
  },
  thumbnail: {
    width: '100%',
    aspectRatio: '16/9',
    objectFit: 'cover',
    backgroundColor: tokens.colorNeutralBackground4,
  },
  meta: {
    display: 'flex',
    gap: '12px',
    marginTop: '4px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    gap: '12px',
  },
});

export default function ViewerDemosPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [demos, setDemos] = useState<DemoSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<DemoSummary[]>('/demos')
      .then(setDemos)
      .catch(() => setDemos([]))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/viewer/login', { replace: true });
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Spinner size="large" label="デモを読み込んでいます..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <AppSymbol size={26} />
          <Title2>デモ一覧</Title2>
        </div>
        <Button icon={<SignOutRegular />} appearance="subtle" onClick={handleLogout}>
          ログアウト
        </Button>
      </div>

      {demos.length === 0 ? (
        <div className={styles.emptyState}>
          <Title2>まだデモがありません</Title2>
          <Body1>デザイナーがデモを作成するまでお待ちください。</Body1>
        </div>
      ) : (
        <div className={styles.grid}>
          {demos.map((demo) => (
            <Card
              key={demo.id}
              className={styles.card}
              onClick={() => navigate(`/player/${demo.id}`)}
            >
              <CardPreview>
                {demo.thumbnailDataUrl ? (
                  <img
                    src={demo.thumbnailDataUrl}
                    alt={demo.title}
                    className={styles.thumbnail}
                  />
                ) : (
                  <div className={styles.thumbnail} />
                )}
              </CardPreview>
              <CardHeader
                header={<Body1><strong>#{demo.demoNumber} {demo.title}</strong></Body1>}
                description={
                  <div className={styles.meta}>
                    <Caption1>{demo.clickPointCount} ステップ</Caption1>
                    <Caption1>{formatDuration(demo.duration)}</Caption1>
                  </div>
                }
                action={
                  <Button
                    icon={<PlayRegular />}
                    appearance="primary"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/player/${demo.id}`);
                    }}
                  >
                    再生
                  </Button>
                }
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
