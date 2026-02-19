/**
 * FavoritesPage — お気に入りデモ管理
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Card,
  CardHeader,
  CardFooter,
  Caption1,
  Tab,
  TabList,
  Spinner,
  Badge,
} from '@fluentui/react-components';
import {
  PlayRegular,
  StarRegular,
  StarFilled,
  HeartRegular,
} from '@fluentui/react-icons';
import EmptyState from '@/components/common/EmptyState';
import * as socialService from '@/services/socialService';
import type { DemoSummary } from '@/services/socialService';
import { apiGet } from '@/services/apiClient';
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: tokens.spacingHorizontalL,
    marginTop: tokens.spacingVerticalL,
  },
  thumbnail: {
    width: '100%',
    height: '140px',
    objectFit: 'cover',
    borderRadius: `${tokens.borderRadiusLarge} ${tokens.borderRadiusLarge} 0 0`,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  card: {
    transition: 'box-shadow 200ms ease',
    ':hover': { boxShadow: tokens.shadow8 },
  },
  cardActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    flexWrap: 'wrap',
  },
  liked: {
    color: tokens.colorPaletteRedForeground1,
  },
});

export default function FavoritesPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'saved' | 'popular'>('saved');
  const [demos, setDemos] = useState<DemoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteSet, setFavoriteSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    const run = async () => {
      const [allDemos, favs] = await Promise.all([
        apiGet<DemoSummary[]>('/demos'),
        socialService.getFavorites(),
      ]);
      setDemos(allDemos);
      setFavoriteSet(new Set(favs.map((f) => f.demoId)));
    };
    run().finally(() => setLoading(false));
  }, []);

  const toggleFavorite = useCallback(async (demoId: string) => {
    if (favoriteSet.has(demoId)) {
      await socialService.removeFavorite(demoId);
      setFavoriteSet((prev) => { const s = new Set(prev); s.delete(demoId); return s; });
    } else {
      await socialService.addFavorite(demoId);
      setFavoriteSet((prev) => new Set([...prev, demoId]));
    }
  }, [favoriteSet]);

  const savedDemos = demos.filter((d) => favoriteSet.has(d.id));
  const popularDemos = [...demos].sort((a, b) => b.likeCount - a.likeCount).slice(0, 20);
  const displayDemos = tab === 'saved' ? savedDemos : popularDemos;

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}><Spinner label="読み込み中..." /></div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Text weight="semibold" size={500}>{MSG.favoritesTitle}</Text>
      </div>

      <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value as 'saved' | 'popular')}>
        <Tab value="saved">{MSG.favoritesSavedTab}</Tab>
        <Tab value="popular">{MSG.favoritesPopularTab}</Tab>
      </TabList>

      {displayDemos.length === 0 ? (
        <EmptyState title={MSG.favoritesEmpty} description="" />
      ) : (
        <div className={styles.grid}>
          {displayDemos.map((demo) => (
            <Card key={demo.id} className={styles.card}>
              {demo.thumbnailDataUrl && (
                <img src={demo.thumbnailDataUrl} alt={demo.title} className={styles.thumbnail} />
              )}
              <CardHeader
                header={<Text weight="semibold">{demo.title}</Text>}
                description={
                  <Caption1>
                    {demo.likeCount > 0 && (
                      <Badge appearance="tint" color="danger" icon={<HeartRegular />}>
                        {demo.likeCount}
                      </Badge>
                    )}
                  </Caption1>
                }
              />
              <CardFooter className={styles.cardActions}>
                <Button
                  size="small"
                  appearance="primary"
                  icon={<PlayRegular />}
                  onClick={() => navigate(`/player/${demo.id}`)}
                >
                  {MSG.play}
                </Button>
                <Button
                  size="small"
                  appearance="subtle"
                  icon={favoriteSet.has(demo.id) ? <StarFilled className={styles.liked} /> : <StarRegular />}
                  onClick={() => void toggleFavorite(demo.id)}
                >
                  {favoriteSet.has(demo.id) ? MSG.unfavorite : MSG.favorite}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
