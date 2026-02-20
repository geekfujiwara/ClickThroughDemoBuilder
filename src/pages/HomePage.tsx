import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Card,
  CardHeader,
  CardFooter,
  Body1,
  Caption1,
  Badge,
  Avatar,
  Spinner,
  Divider,
} from '@fluentui/react-components';
import {
  PlayRegular,
  EditRegular,
  HeartRegular,
  ArrowRepeatAllRegular,
  PersonRegular,
  BookmarkRegular,
} from '@fluentui/react-icons';
import { useAuthStore } from '@/stores/authStore';
import { getHomeRankings, type HomeRankings, type DemoSummary, type CreatorRankingEntry } from '@/services/socialService';
import { getAllProjects } from '@/services/projectService';
import type { DemoProject } from '@/types';
import { MSG } from '@/constants/messages';

const useStyles = makeStyles({
  hero: {
    textAlign: 'center',
    paddingTop: '48px',
    paddingBottom: '48px',
  },
  heroTitle: {
    whiteSpace: 'pre-line',
    lineHeight: '1.4',
  },
  heroActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalXXL,
  },
  section: {
    marginTop: tokens.spacingVerticalXXXL,
  },
  sectionTitle: {
    marginBottom: tokens.spacingVerticalL,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  creatorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: tokens.spacingHorizontalM,
  },
  thumbnail: {
    width: '100%',
    height: '140px',
    objectFit: 'cover',
    borderRadius: `${tokens.borderRadiusLarge} ${tokens.borderRadiusLarge} 0 0`,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  card: {
    cursor: 'pointer',
    transition: 'box-shadow 200ms ease',
    ':hover': {
      boxShadow: tokens.shadow8,
    },
  },
  cardActions: {
    gap: tokens.spacingHorizontalS,
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  statBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXXS,
    color: tokens.colorNeutralForeground3,
  },
  creatorCard: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
  },
  creatorInfo: {
    flex: 1,
    minWidth: 0,
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  activityItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  activityContent: {
    flex: 1,
  },
  spinnerArea: {
    display: 'flex',
    justifyContent: 'center',
    padding: tokens.spacingVerticalXXXL,
  },
});

/** デモカード (ランキング共通) */
function DemoCard({ demo, onPlay, onEdit, onDetail, isDesigner }: {
  demo: DemoSummary;
  onPlay: (id: string) => void;
  onEdit: (id: string) => void;
  onDetail: (id: string) => void;
  isDesigner: boolean;
}) {
  const classes = useStyles();
  return (
    <Card className={classes.card} onClick={() => onDetail(demo.id)}>
      {demo.thumbnailDataUrl ? (
        <img src={demo.thumbnailDataUrl} alt={demo.title} className={classes.thumbnail} />
      ) : (
        <div className={classes.thumbnail} />
      )}
      <CardHeader
        header={
          <div className={classes.cardTitleRow}>
            {demo.demoNumber ? (
              <Badge appearance="outline" size="small">#{demo.demoNumber}</Badge>
            ) : null}
            <Body1><strong>{demo.title}</strong></Body1>
          </div>
        }
        description={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
            {demo.likeCount != null && (
              <Caption1 className={classes.statBadge}>
                <HeartRegular fontSize={12} /> {demo.likeCount}
              </Caption1>
            )}
            {demo.playCount != null && (
              <Caption1 className={classes.statBadge}>
                <PlayRegular fontSize={12} /> {demo.playCount}
              </Caption1>
            )}
            {demo.commentCount != null && (
              <Caption1 className={classes.statBadge}>
                💬 {demo.commentCount}
              </Caption1>
            )}
          </div>
        }
      />
      <CardFooter className={classes.cardActions}>
        <Button
          icon={<PlayRegular />}
          size="small"
          onClick={(e) => { e.stopPropagation(); onPlay(demo.id); }}
        >
          再生
        </Button>
        {isDesigner && (
          <Button icon={<EditRegular />} size="small" appearance="subtle" onClick={(e) => { e.stopPropagation(); onEdit(demo.id); }}>
            編集
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

/** 作成者ランキングカード */
function CreatorCard({ entry, rank, valueKey, unit }: {
  entry: CreatorRankingEntry;
  rank: number;
  valueKey: 'totalLikes' | 'demoCount';
  unit: string;
}) {
  const classes = useStyles();
  const value = entry[valueKey] ?? 0;
  return (
    <Card className={classes.card}>
      <div className={classes.creatorCard}>
        <Badge appearance="filled" color={rank === 1 ? 'warning' : rank === 2 ? 'informative' : 'subtle'}>
          #{rank}
        </Badge>
        <Avatar name={entry.name} size={36} icon={<PersonRegular />} />
        <div className={classes.creatorInfo}>
          <Body1><strong>{entry.name}</strong></Body1>
          <Caption1 style={{ display: 'block', color: 'var(--colorNeutralForeground3)' }}>
            {value} {unit}
          </Caption1>
        </div>
      </div>
    </Card>
  );
}

export default function HomePage() {
  const classes = useStyles();
  const navigate = useNavigate();
  const { role, selectedCreator } = useAuthStore();
  const isDesigner = role === 'designer';

  const [rankings, setRankings] = useState<HomeRankings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [myDemos, setMyDemos] = useState<DemoProject[]>([]);

  useEffect(() => {
    getHomeRankings()
      .then(setRankings)
      .catch(() => setRankings(null))
      .finally(() => setIsLoading(false));
  }, []);

  // 自分が作成したデモを取得
  useEffect(() => {
    if (!selectedCreator) return;
    getAllProjects()
      .then((projects) => {
        setMyDemos(
          projects
            .filter((p) => p.creatorId === selectedCreator.id)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        );
      })
      .catch(() => setMyDemos([]));
  }, [selectedCreator]);

  const handlePlay = useCallback((id: string) => navigate(`/player/${id}`), [navigate]);
  const handleEdit = useCallback((id: string) => navigate(`/designer/${id}`), [navigate]);
  const handleDetail = useCallback((id: string) => navigate(`/demos/${id}`), [navigate]);

  return (
    <>
      {/* ヒーローセクション */}
      <section className={classes.hero}>
        <Text as="h1" size={800} weight="semibold" className={classes.heroTitle}>
          {MSG.homeHeroTitle}
        </Text>
        <div className={classes.heroActions}>
          {isDesigner && (
            <Button appearance="primary" size="large" onClick={() => navigate('/designer')}>
              {MSG.homeNewProject}
            </Button>
          )}
          <Button appearance="secondary" size="large" onClick={() => navigate('/projects')}>
            {MSG.homeViewProjects}
          </Button>
          <Button appearance="subtle" size="large" icon={<ArrowRepeatAllRegular />} onClick={() => navigate('/feed')}>
            {MSG.navFeed}
          </Button>
          <Button appearance="subtle" size="large" icon={<BookmarkRegular />} onClick={() => navigate('/favorites')}>
            {MSG.navFavorites}
          </Button>
        </div>
      </section>

      {isLoading ? (
        <div className={classes.spinnerArea}>
          <Spinner label="読み込み中..." />
        </div>
      ) : rankings ? (
        <>
          {/* あなたが作成したデモ */}
          {selectedCreator && (
            <section className={classes.section}>
              <Text as="h2" size={600} weight="semibold" className={classes.sectionTitle}>
                {MSG.homeMyDemos}
              </Text>
              {myDemos.length === 0 ? (
                <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{MSG.homeMyDemosEmpty}</Caption1>
              ) : (
                <div className={classes.grid}>
                  {myDemos.map((demo) => (
                    <DemoCard
                      key={demo.id}
                      demo={{
                        id: demo.id,
                        title: demo.title,
                        demoNumber: demo.demoNumber,
                        description: demo.description ?? '',
                        groupId: demo.groupId,
                        creatorId: demo.creatorId,
                        thumbnailDataUrl: demo.video?.thumbnailDataUrl ?? '',
                        clickPointCount: demo.clickPoints?.length ?? 0,
                        duration: demo.video?.duration ?? 0,
                        updatedAt: demo.updatedAt,
                        createdAt: demo.createdAt,
                        likeCount: demo.likeCount ?? 0,
                        playCount: demo.playCount ?? 0,
                        commentCount: demo.commentCount ?? 0,
                      }}
                      onPlay={handlePlay}
                      onEdit={handleEdit}
                      onDetail={handleDetail}
                      isDesigner={isDesigner}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 人気のデモ (いいね数順) */}
          {rankings.popularByLikes.length > 0 && (
            <section className={classes.section}>
              <Text as="h2" size={600} weight="semibold" className={classes.sectionTitle}>
                {MSG.homeRankingByLikes}
              </Text>
              <div className={classes.grid}>
                {rankings.popularByLikes.map((demo) => (
                  <DemoCard key={demo.id} demo={demo} onPlay={handlePlay} onEdit={handleEdit} onDetail={handleDetail} isDesigner={isDesigner} />
                ))}
              </div>
            </section>
          )}

          {/* 最近追加されたデモ */}
          {rankings.recentDemos.length > 0 && (
            <section className={classes.section}>
              <Divider />
              <Text as="h2" size={600} weight="semibold" className={classes.sectionTitle} style={{ marginTop: '24px' }}>
                {MSG.homeRecentDemos}
              </Text>
              <div className={classes.grid}>
                {rankings.recentDemos.map((demo) => (
                  <DemoCard key={demo.id} demo={demo} onPlay={handlePlay} onEdit={handleEdit} onDetail={handleDetail} isDesigner={isDesigner} />
                ))}
              </div>
            </section>
          )}

          {/* 再生数が多いデモ */}
          {rankings.popularByPlay.length > 0 && (
            <section className={classes.section}>
              <Divider />
              <Text as="h2" size={600} weight="semibold" className={classes.sectionTitle} style={{ marginTop: '24px' }}>
                {MSG.homeRankingByPlay}
              </Text>
              <div className={classes.grid}>
                {rankings.popularByPlay.map((demo) => (
                  <DemoCard key={demo.id} demo={demo} onPlay={handlePlay} onEdit={handleEdit} onDetail={handleDetail} isDesigner={isDesigner} />
                ))}
              </div>
            </section>
          )}

          {/* 最近のアクティビティ (コメント) */}
          {rankings.recentComments.length > 0 && (
            <section className={classes.section}>
              <Divider />
              <Text as="h2" size={600} weight="semibold" className={classes.sectionTitle} style={{ marginTop: '24px' }}>
                {MSG.homeRecentActivity}
              </Text>
              <div className={classes.activityList}>
                {rankings.recentComments.map((entry) => (
                  <div key={entry.id} className={classes.activityItem}>
                    <Avatar name={entry.actorName} size={28} icon={<PersonRegular />} />
                    <div className={classes.activityContent}>
                      <Caption1>
                        <strong>{entry.actorName}</strong>{' '}
                        {entry.eventType === 'comment' ? 'がコメントしました' : 'がいいねしました'}
                        {entry.demoTitle ? ` 「${entry.demoTitle}」` : ''}
                      </Caption1>
                      {entry.commentBody && (
                        <Caption1 style={{ display: 'block', color: 'var(--colorNeutralForeground3)', marginTop: '2px' }}>
                          {entry.commentBody}
                        </Caption1>
                      )}
                    </div>
                    <Caption1 style={{ color: 'var(--colorNeutralForeground4)', whiteSpace: 'nowrap' }}>
                      {new Date(entry.createdAt).toLocaleDateString('ja-JP')}
                    </Caption1>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 総再生時間が長いデモ */}
          {rankings.popularByDuration.length > 0 && (
            <section className={classes.section}>
              <Divider />
              <Text as="h2" size={600} weight="semibold" className={classes.sectionTitle} style={{ marginTop: '24px' }}>
                {MSG.homeRankingByDuration}
              </Text>
              <div className={classes.grid}>
                {rankings.popularByDuration.map((demo) => (
                  <DemoCard key={demo.id} demo={demo} onPlay={handlePlay} onEdit={handleEdit} onDetail={handleDetail} isDesigner={isDesigner} />
                ))}
              </div>
            </section>
          )}

          {/* 人気のデモ作成者 */}
          {rankings.topCreatorsByLikes.length > 0 && (
            <section className={classes.section}>
              <Divider />
              <Text as="h2" size={600} weight="semibold" className={classes.sectionTitle} style={{ marginTop: '24px' }}>
                {MSG.homeTopCreatorsByLikes}
              </Text>
              <div className={classes.creatorGrid}>
                {rankings.topCreatorsByLikes.map((entry, i) => (
                  <CreatorCard key={entry.id} entry={entry} rank={i + 1} valueKey="totalLikes" unit="いいね" />
                ))}
              </div>
            </section>
          )}

          {/* デモ数が多い作成者 */}
          {rankings.topCreatorsByDemos.length > 0 && (
            <section className={classes.section}>
              <Divider />
              <Text as="h2" size={600} weight="semibold" className={classes.sectionTitle} style={{ marginTop: '24px' }}>
                {MSG.homeTopCreatorsByDemos}
              </Text>
              <div className={classes.creatorGrid}>
                {rankings.topCreatorsByDemos.map((entry, i) => (
                  <CreatorCard key={entry.id} entry={entry} rank={i + 1} valueKey="demoCount" unit="デモ" />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        /* ランキングが取得できなかった場合 */
        <section className={classes.section}>
          <Text>{MSG.homeEmptyDescription}</Text>
        </section>
      )}
    </>
  );
}
