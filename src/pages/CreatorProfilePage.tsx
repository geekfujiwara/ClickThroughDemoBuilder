/**
 * CreatorProfilePage — ユーザーの公開プロフィール（読み取り専用）
 * - 自己紹介・SNSリンク（X / LinkedIn / YouTube）
 * - 公開デモ / 動画統計のサマリ
 * - 公開したデモ一覧
 * - コメント（他のユーザーが残せる）
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Badge,
  Avatar,
  Spinner,
  Card,
  CardHeader,
  CardFooter,
  Body1,
  Body2,
  Caption1,
  Textarea,
  Tooltip,
} from '@fluentui/react-components';
import {
  ArrowLeftRegular,
  PersonRegular,
  PlayRegular,
  HeartRegular,
  ChatRegular,
  DeleteRegular,
  EditRegular,
} from '@fluentui/react-icons';
import { useAuthStore } from '@/stores/authStore';
import { useGuestNavigate } from '@/hooks/useGuestNav';
import { getCreatorProfile, type CreatorProfile, type ProfileDemoSummary } from '@/services/creatorService';
import { getProfileComments, addProfileComment, deleteProfileComment } from '@/services/socialService';
import type { ProfileComment } from '@/types';
import { useMsg } from '@/hooks/useMsg';

const useStyles = makeStyles({
  page: {
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalXXXL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXL,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalL,
    flexWrap: 'wrap',
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  },
  bio: {
    color: tokens.colorNeutralForeground2,
    whiteSpace: 'pre-wrap',
    lineHeight: '1.6',
  },
  bioEmpty: {
    color: tokens.colorNeutralForeground4,
    fontStyle: 'italic',
  },
  socialRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  socialLink: {
    textDecoration: 'none',
  },
  sectionTitle: {
    marginBottom: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalXS,
    borderBottom: `2px solid ${tokens.colorBrandBackground}`,
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: tokens.spacingHorizontalM,
  },
  kpiCard: {
    textAlign: 'center',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  kpiValue: {
    display: 'block',
    fontSize: '26px',
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: '1.2',
    marginBottom: '4px',
  },
  kpiLabel: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  thumbnail: {
    width: '100%',
    height: '130px',
    objectFit: 'cover',
    borderRadius: `${tokens.borderRadiusLarge} ${tokens.borderRadiusLarge} 0 0`,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  card: {
    cursor: 'pointer',
    transition: 'box-shadow 200ms ease',
    ':hover': { boxShadow: tokens.shadow8 },
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
  commentForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalXL,
  },
  commentFormActions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  commentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  commentItem: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  commentContent: {
    flex: '1',
    minWidth: 0,
  },
  commentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalXS,
    flexWrap: 'wrap',
  },
  commentDate: {
    color: tokens.colorNeutralForeground4,
    fontSize: tokens.fontSizeBase200,
    marginLeft: 'auto',
  },
  commentBody: {
    color: tokens.colorNeutralForeground1,
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  spinnerArea: {
    display: 'flex',
    justifyContent: 'center',
    padding: tokens.spacingVerticalXXXL,
  },
  noData: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXXXL,
    color: tokens.colorNeutralForeground3,
  },
});

function KpiCard({ value, label, color }: { value: number | string; label: string; color: string }) {
  const classes = useStyles();
  return (
    <div className={classes.kpiCard}>
      <span className={classes.kpiValue} style={{ color }}>{value}</span>
      <span className={classes.kpiLabel}>{label}</span>
    </div>
  );
}

function DemoCard({ demo, onDetail }: { demo: ProfileDemoSummary; onDetail: (id: string) => void }) {
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
            {demo.demoNumber ? <Badge appearance="outline" size="small">#{demo.demoNumber}</Badge> : null}
            <Body1><strong>{demo.title}</strong></Body1>
          </div>
        }
      />
      <CardFooter>
        <Caption1 className={classes.statBadge}><HeartRegular fontSize={12} /> {demo.likeCount}</Caption1>
        <Caption1 className={classes.statBadge}><PlayRegular fontSize={12} /> {demo.playCount}</Caption1>
        <Caption1 className={classes.statBadge}><ChatRegular fontSize={12} /> {demo.commentCount}</Caption1>
      </CardFooter>
    </Card>
  );
}

export default function CreatorProfilePage() {
  const MSG = useMsg();
  const classes = useStyles();
  const navigate = useGuestNavigate();
  const { creatorId } = useParams<{ creatorId: string }>();
  const { selectedCreator, isGuest } = useAuthStore();

  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<ProfileComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentPosting, setCommentPosting] = useState(false);

  useEffect(() => {
    if (!creatorId) return;
    setLoading(true);
    Promise.all([
      getCreatorProfile(creatorId),
      getProfileComments(creatorId),
    ])
      .then(([prof, cmts]) => {
        setProfile(prof);
        setComments(cmts);
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [creatorId]);

  const handleDetail = useCallback((id: string) => navigate(`/demos/${id}`), [navigate]);

  const handlePostComment = useCallback(async () => {
    if (!creatorId || !commentText.trim() || commentPosting) return;
    setCommentPosting(true);
    try {
      const newComment = await addProfileComment(creatorId, commentText.trim());
      setComments((prev) => [newComment, ...prev]);
      setCommentText('');
    } catch { /* ignore */ } finally {
      setCommentPosting(false);
    }
  }, [creatorId, commentText, commentPosting]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!creatorId || !confirm(MSG.creatorProfileCommentDeleteConfirm)) return;
    try {
      await deleteProfileComment(creatorId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch { /* ignore */ }
  }, [creatorId, MSG]);

  if (loading) {
    return <div className={classes.spinnerArea}><Spinner label={MSG.loading} size="large" /></div>;
  }

  if (!profile) {
    return (
      <div className={classes.noData}>
        <Text size={500} weight="semibold">{MSG.creatorProfileNotFound}</Text>
        <br />
        <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={() => navigate(-1)} style={{ marginTop: '16px' }}>
          {MSG.creatorProfileBack}
        </Button>
      </div>
    );
  }

  const { creator, stats, demos } = profile;
  const isOwnProfile = selectedCreator?.id === creator.id;

  return (
    <div className={classes.page}>
      <div>
        <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={() => navigate(-1)}>
          {MSG.creatorProfileBack}
        </Button>
      </div>

      {/* ヘッダー */}
      <div className={classes.header}>
        <Avatar name={creator.name} size={72} icon={<PersonRegular />} color="colorful" />
        <div className={classes.headerInfo}>
          <Text as="h1" size={700} weight="semibold">{creator.name}</Text>
          {creator.bio ? (
            <Body2 className={classes.bio}>{creator.bio}</Body2>
          ) : (
            <Body2 className={classes.bioEmpty}>{MSG.creatorProfileNoBio}</Body2>
          )}
          {(creator.xUrl || creator.linkedInUrl || creator.youTubeUrl) && (
            <div className={classes.socialRow} style={{ marginTop: tokens.spacingVerticalXS }}>
              {creator.xUrl && (
                <a href={creator.xUrl} target="_blank" rel="noopener noreferrer" className={classes.socialLink}>
                  <Button appearance="secondary" size="small">X</Button>
                </a>
              )}
              {creator.linkedInUrl && (
                <a href={creator.linkedInUrl} target="_blank" rel="noopener noreferrer" className={classes.socialLink}>
                  <Button appearance="secondary" size="small">LinkedIn</Button>
                </a>
              )}
              {creator.youTubeUrl && (
                <a href={creator.youTubeUrl} target="_blank" rel="noopener noreferrer" className={classes.socialLink}>
                  <Button appearance="secondary" size="small">YouTube</Button>
                </a>
              )}
            </div>
          )}
        </div>
        {isOwnProfile && (
          <Button
            appearance="primary"
            icon={<EditRegular />}
            style={{ marginLeft: 'auto', alignSelf: 'flex-start' }}
            onClick={() => navigate('/profile')}
          >
            {MSG.creatorProfileEdit}
          </Button>
        )}
      </div>

      {/* 統計サマリ */}
      <section>
        <Text as="h2" size={500} weight="semibold" className={classes.sectionTitle}>
          {MSG.creatorProfileStatsTitle}
        </Text>
        <div className={classes.kpiGrid}>
          <KpiCard value={stats.demoCount} label={MSG.creatorProfileStatDemos} color="#0078D4" />
          <KpiCard value={stats.totalLikes} label={MSG.creatorProfileStatLikes} color="#D13438" />
          <KpiCard value={stats.totalPlays} label={MSG.creatorProfileStatPlays} color="#107C10" />
          <KpiCard value={stats.totalComments} label={MSG.creatorProfileStatComments} color="#CA5010" />
        </div>
      </section>

      {/* 公開したデモ */}
      <section>
        <Text as="h2" size={500} weight="semibold" className={classes.sectionTitle}>
          {MSG.creatorProfileDemosTitle}
        </Text>
        {demos.length === 0 ? (
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{MSG.creatorProfileDemosEmpty}</Caption1>
        ) : (
          <div className={classes.grid}>
            {demos.map((demo) => (
              <DemoCard key={demo.id} demo={demo} onDetail={handleDetail} />
            ))}
          </div>
        )}
      </section>

      {/* コメント */}
      <section>
        <Text as="h2" size={500} weight="semibold" className={classes.sectionTitle}>
          {MSG.creatorProfileCommentsTitle}
        </Text>

        {!isGuest && (
          <div className={classes.commentForm}>
            <Textarea
              placeholder={MSG.creatorProfileCommentPlaceholder}
              value={commentText}
              onChange={(_, d) => setCommentText(d.value)}
              resize="vertical"
              maxLength={2000}
            />
            <div className={classes.commentFormActions}>
              <Button
                appearance="primary"
                disabled={!commentText.trim() || commentPosting}
                onClick={() => void handlePostComment()}
              >
                {commentPosting ? MSG.creatorProfileCommentPosting : MSG.creatorProfileCommentPost}
              </Button>
            </div>
          </div>
        )}

        {comments.length === 0 ? (
          <div className={classes.noData}>
            <Caption1>{MSG.creatorProfileCommentEmpty}</Caption1>
          </div>
        ) : (
          <div className={classes.commentList}>
            {comments.map((c) => (
              <div key={c.id} className={classes.commentItem}>
                <Avatar name={c.creatorName} size={32} icon={<PersonRegular />} />
                <div className={classes.commentContent}>
                  <div className={classes.commentHeader}>
                    <Body1><strong>{c.creatorName}</strong></Body1>
                    <Caption1 className={classes.commentDate}>
                      {new Date(c.createdAt).toLocaleString('ja-JP', {
                        year: 'numeric', month: 'numeric', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </Caption1>
                    {(selectedCreator?.id === c.creatorId || selectedCreator?.id === creator.id) && (
                      <Tooltip content={MSG.delete} relationship="label">
                        <Button
                          appearance="subtle"
                          icon={<DeleteRegular />}
                          size="small"
                          style={{ marginLeft: 'auto' }}
                          onClick={() => void handleDeleteComment(c.id)}
                        />
                      </Tooltip>
                    )}
                  </div>
                  <Body2 className={classes.commentBody}>{c.body}</Body2>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
