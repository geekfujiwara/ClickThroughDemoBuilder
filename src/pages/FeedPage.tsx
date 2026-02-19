/**
 * FeedPage — ソーシャルアクティビティフィード
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Spinner,
  Card,
} from '@fluentui/react-components';
import {
  HeartRegular,
  ChatRegular,
  AddRegular,
  PersonAddRegular,
} from '@fluentui/react-icons';
import * as socialService from '@/services/socialService';
import type { FeedEntry } from '@/types';
import { MSG } from '@/constants/messages';

const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  entry: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
  },
  icon: {
    flexShrink: 0,
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontSize: '18px',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
  },
  demoLink: {
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
    textDecoration: 'none',
    ':hover': { textDecoration: 'underline' },
  },
  time: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  comment: {
    color: tokens.colorNeutralForeground2,
    fontStyle: 'italic',
    marginTop: '2px',
  },
  emptyState: {
    textAlign: 'center',
    padding: `${tokens.spacingVerticalXXXL} 0`,
    color: tokens.colorNeutralForeground3,
  },
});

function FeedIcon({ type }: { type: FeedEntry['eventType'] }) {
  const styles = useStyles();
  const iconMap = {
    like: <HeartRegular />,
    comment: <ChatRegular />,
    new_demo: <AddRegular />,
    new_designer: <PersonAddRegular />,
  };
  return <div className={styles.icon}>{iconMap[type]}</div>;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  return date.toLocaleDateString('ja-JP');
}

function FeedEntryCard({ entry }: { entry: FeedEntry }) {
  const styles = useStyles();

  const actionText = {
    like: MSG.feedLiked,
    comment: MSG.feedCommented,
    new_demo: MSG.feedNewDemo,
    new_designer: MSG.feedNewDesigner,
  }[entry.eventType];

  return (
    <Card className={styles.entry}>
      <FeedIcon type={entry.eventType} />
      <div className={styles.content}>
        <Text>
          <strong>{entry.actorName}</strong>{' '}
          {actionText}
          {entry.demoTitle && entry.demoId && (
            <>
              {' '}「
              <Link to={`/player/${entry.demoId}`} className={styles.demoLink}>
                {entry.demoTitle}
              </Link>
              」
            </>
          )}
        </Text>
        {entry.commentBody && (
          <Text className={styles.comment}>"{entry.commentBody}"</Text>
        )}
        <Text className={styles.time}>{formatTime(entry.createdAt)}</Text>
      </div>
    </Card>
  );
}

export default function FeedPage() {
  const styles = useStyles();
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (before?: string) => {
    const data = await socialService.getFeed(20, before);
    if (before) {
      setEntries((prev) => [...prev, ...data]);
    } else {
      setEntries(data);
    }
    setHasMore(data.length === 20);
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const loadMore = useCallback(async () => {
    const last = entries[entries.length - 1];
    if (!last) return;
    setLoadingMore(true);
    await load(last.createdAt).finally(() => setLoadingMore(false));
  }, [entries, load]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Text weight="semibold" size={500}>{MSG.feedTitle}</Text>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spinner label="読み込み中..." />
        </div>
      ) : entries.length === 0 ? (
        <div className={styles.emptyState}>
          <Text>{MSG.feedEmpty}</Text>
        </div>
      ) : (
        <>
          <div className={styles.list}>
            {entries.map((e) => (
              <FeedEntryCard key={e.id} entry={e} />
            ))}
          </div>
          {hasMore && (
            <Button
              appearance="subtle"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              icon={loadingMore ? <Spinner size="tiny" /> : undefined}
            >
              さらに読み込む
            </Button>
          )}
        </>
      )}
    </div>
  );
}
