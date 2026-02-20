import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Badge,
  Avatar,
  Spinner,
  Textarea,
  TabList,
  Tab,
  Card,
  Caption1,
  Body1,
  Body2,
  Tooltip,
  Divider,
} from '@fluentui/react-components';
import type { SelectTabData, SelectTabEvent } from '@fluentui/react-components';
import {
  PlayRegular,
  EditRegular,
  ArrowLeftRegular,
  HeartRegular,
  HeartFilled,
  BookmarkRegular,
  BookmarkFilled,
  PersonRegular,
  DeleteRegular,
  ChatRegular,
  DataBarVerticalRegular,
} from '@fluentui/react-icons';
import { useAuthStore } from '@/stores/authStore';
import { getProject } from '@/services/projectService';
import {
  getComments,
  addComment,
  deleteComment,
  getLikeStatus,
  addLike,
  removeLike,
  getFavorites,
  addFavorite,
  removeFavorite,
} from '@/services/socialService';
import { getDemoStats, type DemoStats } from '@/services/statsService';
import type { DemoProject, DemoComment } from '@/types';
import { MSG } from '@/constants/messages';

// ── Styles ────────────────────────────────────────────────────

const useStyles = makeStyles({
  root: {
    maxWidth: '900px',
    margin: '0 auto',
    paddingBottom: tokens.spacingVerticalXXXL,
  },
  backBar: {
    display: 'flex',
    alignItems: 'center',
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalM,
  },
  // Hero
  hero: {
    borderRadius: tokens.borderRadiusXLarge,
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground2,
    boxShadow: tokens.shadow8,
    marginBottom: tokens.spacingVerticalXL,
  },
  thumbnail: {
    width: '100%',
    maxHeight: '420px',
    objectFit: 'cover',
    display: 'block',
    backgroundColor: tokens.colorNeutralBackground3,
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '280px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground3,
    fontSize: '48px',
  },
  heroBody: {
    padding: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalXL,
    paddingRight: tokens.spacingHorizontalXL,
  },
  heroMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    marginBottom: tokens.spacingVerticalS,
  },
  heroTitle: {
    marginBottom: tokens.spacingVerticalS,
    lineHeight: '1.3',
  },
  heroDescription: {
    color: tokens.colorNeutralForeground2,
    marginBottom: tokens.spacingVerticalM,
    whiteSpace: 'pre-wrap',
  },
  heroStats: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalL,
    flexWrap: 'wrap',
    marginBottom: tokens.spacingVerticalL,
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground2,
  },
  heroActions: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  // Tabs
  tabArea: {
    marginTop: tokens.spacingVerticalL,
  },
  tabPanel: {
    marginTop: tokens.spacingVerticalXL,
  },
  // Comment Tab
  commentForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalXL,
  },
  commentTextarea: {
    resize: 'vertical',
    minHeight: '80px',
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
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
  commentContent: {
    flex: 1,
    minWidth: 0,
  },
  commentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalXS,
  },
  commentBody: {
    color: tokens.colorNeutralForeground1,
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  commentDate: {
    color: tokens.colorNeutralForeground4,
    fontSize: tokens.fontSizeBase200,
    marginLeft: 'auto',
  },
  // Stats Tab
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalXXL,
  },
  statCard: {
    textAlign: 'center',
    padding: tokens.spacingVerticalL,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  statCardValue: {
    display: 'block',
    fontSize: '28px',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorBrandForeground1,
    lineHeight: '1.2',
    marginBottom: tokens.spacingVerticalXS,
  },
  statCardLabel: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
  chartSection: {
    marginBottom: tokens.spacingVerticalXXL,
  },
  chartTitle: {
    marginBottom: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground1,
  },
  chartContainer: {
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusLarge,
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    overflowX: 'auto',
  },
  hbarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalS,
  },
  hbarLabel: {
    width: '200px',
    minWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    flexShrink: 0,
  },
  hbarTrack: {
    flex: 1,
    height: '24px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
    overflow: 'hidden',
    position: 'relative',
  },
  hbarFill: {
    height: '100%',
    borderRadius: tokens.borderRadiusMedium,
    transition: 'width 600ms ease',
  },
  hbarValue: {
    marginLeft: tokens.spacingHorizontalS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    minWidth: '32px',
  },
  chartLegend: {
    display: 'flex',
    gap: tokens.spacingHorizontalL,
    marginTop: tokens.spacingVerticalS,
    flexWrap: 'wrap',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  noData: {
    textAlign: 'center',
    padding: tokens.spacingVerticalXXXL,
    color: tokens.colorNeutralForeground3,
  },
  spinnerArea: {
    display: 'flex',
    justifyContent: 'center',
    padding: tokens.spacingVerticalXXXL,
  },
});

// ── Sub-components ──────────────────────────────────────────

/** 水平バーチャート (サイト・役割別) */
function HorizontalBarChart({
  data,
  color,
}: {
  data: { label: string; value: number }[];
  color: string;
}) {
  const classes = useStyles();
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div>
      {data.map((d) => (
        <div key={d.label} className={classes.hbarRow}>
          <Caption1 className={classes.hbarLabel} title={d.label}>{d.label}</Caption1>
          <div className={classes.hbarTrack}>
            <div
              className={classes.hbarFill}
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: color }}
            />
          </div>
          <Caption1 className={classes.hbarValue}>{d.value}</Caption1>
        </div>
      ))}
    </div>
  );
}

/** SVG 日別バーチャート */
function DailyBarChart({ data }: { data: import('@/services/statsService').DailyPlay[] }) {
  const classes = useStyles();
  if (!data.length) return null;

  const W = 760;
  const H = 160;
  const PAD_LEFT = 36;
  const PAD_BOTTOM = 40;
  const PAD_TOP = 16;
  const chartW = W - PAD_LEFT - 8;
  const chartH = H - PAD_BOTTOM - PAD_TOP;

  const maxVal = Math.max(...data.map((d) => d.views), 1);
  const barGroupW = chartW / data.length;
  const barW = Math.max(4, Math.min(18, barGroupW * 0.38));
  const gap = Math.max(1, barGroupW * 0.08);
  const VIEWS_COLOR = '#0078D4';
  const COMP_COLOR = '#107C10';

  // y-axis ticks
  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: '160px', display: 'block', overflow: 'visible' }}
      >
        {/* Grid lines */}
        {yTicks.map((t) => {
          const y = PAD_TOP + chartH - (t / maxVal) * chartH;
          return (
            <g key={t}>
              <line
                x1={PAD_LEFT} y1={y}
                x2={W - 4} y2={y}
                stroke="#e0e0e0"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              <text x={PAD_LEFT - 4} y={y + 4} textAnchor="end" fontSize="10" fill="#999">
                {t}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = PAD_LEFT + i * barGroupW + (barGroupW - barW * 2 - gap) / 2;
          const viewsH = (d.views / maxVal) * chartH;
          const compH = (d.completions / maxVal) * chartH;

          // X axis label (every 5th day)
          const showLabel = i % 5 === 0 || i === data.length - 1;
          const labelShort = d.date.slice(5); // MM-DD

          return (
            <g key={d.date}>
              {/* Views bar */}
              <rect
                x={x}
                y={PAD_TOP + chartH - viewsH}
                width={barW}
                height={viewsH}
                fill={VIEWS_COLOR}
                rx="2"
                opacity="0.85"
              >
                <title>{d.date}: 再生 {d.views}</title>
              </rect>
              {/* Completions bar */}
              <rect
                x={x + barW + gap}
                y={PAD_TOP + chartH - compH}
                width={barW}
                height={compH}
                fill={COMP_COLOR}
                rx="2"
                opacity="0.85"
              >
                <title>{d.date}: 完了 {d.completions}</title>
              </rect>
              {/* X label */}
              {showLabel && (
                <text
                  x={x + barW + gap / 2}
                  y={PAD_TOP + chartH + 16}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#999"
                >
                  {labelShort}
                </text>
              )}
            </g>
          );
        })}

        {/* Bottom axis */}
        <line
          x1={PAD_LEFT} y1={PAD_TOP + chartH}
          x2={W - 4} y2={PAD_TOP + chartH}
          stroke="#ccc"
          strokeWidth="1"
        />
      </svg>
      {/* Legend */}
      <div className={classes.chartLegend}>
        <div className={classes.legendItem}>
          <div className={classes.legendDot} style={{ backgroundColor: VIEWS_COLOR }} />
          <Caption1>再生開始</Caption1>
        </div>
        <div className={classes.legendItem}>
          <div className={classes.legendDot} style={{ backgroundColor: COMP_COLOR }} />
          <Caption1>完了</Caption1>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function DemoDetailPage() {
  const { demoId } = useParams<{ demoId: string }>();
  const navigate = useNavigate();
  const classes = useStyles();
  const { role, selectedCreator } = useAuthStore();
  const isDesigner = role === 'designer';

  // demo data
  const [demo, setDemo] = useState<DemoProject | null>(null);
  const [demoLoading, setDemoLoading] = useState(true);

  // social state
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);

  // comments
  const [comments, setComments] = useState<DemoComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentPosting, setCommentPosting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // stats
  const [stats, setStats] = useState<DemoStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // active tab
  const [activeTab, setActiveTab] = useState<string>('comments');

  // ── Init ────────────────────────────────────────────────────

  useEffect(() => {
    if (!demoId) return;
    setDemoLoading(true);
    Promise.all([
      getProject(demoId),
      getLikeStatus(demoId),
      getFavorites(),
      getComments(demoId),
    ])
      .then(([project, likeStatus, favorites, cmts]) => {
        setDemo(project ?? null);
        setIsLiked(likeStatus.liked);
        setLikeCount(likeStatus.count);
        setIsFavorited(favorites.some((f) => f.demoId === demoId));
        setComments(cmts.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      })
      .catch(() => setDemo(null))
      .finally(() => setDemoLoading(false));
  }, [demoId]);

  // stats を統計タブ選択時に遅延ロード
  useEffect(() => {
    if (activeTab !== 'stats' || !demoId || stats !== null) return;
    setStatsLoading(true);
    getDemoStats(demoId)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [activeTab, demoId, stats]);

  // ── Handlers ────────────────────────────────────────────────

  const handleLikeToggle = useCallback(async () => {
    if (!demoId) return;
    const prevLiked = isLiked;
    const prevCount = likeCount;
    setIsLiked(!prevLiked);
    setLikeCount(prevLiked ? prevCount - 1 : prevCount + 1);
    try {
      if (prevLiked) await removeLike(demoId);
      else await addLike(demoId);
    } catch {
      setIsLiked(prevLiked);
      setLikeCount(prevCount);
    }
  }, [demoId, isLiked, likeCount]);

  const handleFavoriteToggle = useCallback(async () => {
    if (!demoId) return;
    const prev = isFavorited;
    setIsFavorited(!prev);
    try {
      if (prev) await removeFavorite(demoId);
      else await addFavorite(demoId);
    } catch {
      setIsFavorited(prev);
    }
  }, [demoId, isFavorited]);

  const handlePostComment = useCallback(async () => {
    if (!demoId || !commentText.trim() || commentPosting) return;
    setCommentPosting(true);
    try {
      const newComment = await addComment(demoId, commentText.trim());
      setComments((prev) => [newComment, ...prev]);
      setCommentText('');
    } catch {
      // ignore
    } finally {
      setCommentPosting(false);
    }
  }, [demoId, commentText, commentPosting]);

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!demoId) return;
      if (!confirm(MSG.demoDetailCommentDeleteConfirm)) return;
      try {
        await deleteComment(demoId, commentId);
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      } catch {
        // ignore
      }
    },
    [demoId],
  );

  const handleTabSelect = useCallback((_: SelectTabEvent, data: SelectTabData) => {
    setActiveTab(data.value as string);
  }, []);

  // ── Render guards ─────────────────────────────────────────

  if (demoLoading) {
    return (
      <div className={classes.spinnerArea}>
        <Spinner label={MSG.loading} size="large" />
      </div>
    );
  }

  if (!demo) {
    return (
      <div style={{ padding: tokens.spacingVerticalXXXL, textAlign: 'center' }}>
        <Text size={500} weight="semibold">デモが見つかりません</Text>
        <br />
        <Button appearance="subtle" onClick={() => navigate(-1)} style={{ marginTop: '16px' }}>
          {MSG.demoDetailBack}
        </Button>
      </div>
    );
  }

  const durationStr = demo.video?.duration
    ? MSG.demoDetailInfoDuration(demo.video.duration)
    : null;
  const updatedStr = MSG.demoDetailInfoUpdated(
    new Date(demo.updatedAt).toLocaleDateString('ja-JP'),
  );

  return (
    <div className={classes.root}>
      {/* Back button */}
      <div className={classes.backBar}>
        <Button
          appearance="subtle"
          icon={<ArrowLeftRegular />}
          onClick={() => navigate(-1)}
        >
          {MSG.demoDetailBack}
        </Button>
      </div>

      {/* Hero Card */}
      <div className={classes.hero}>
        {demo.video?.thumbnailDataUrl ? (
          <img
            src={demo.video.thumbnailDataUrl}
            alt={demo.title}
            className={classes.thumbnail}
          />
        ) : (
          <div className={classes.thumbnailPlaceholder}>🎬</div>
        )}

        <div className={classes.heroBody}>
          {/* Meta badges */}
          <div className={classes.heroMeta}>
            {demo.demoNumber ? (
              <Badge appearance="outline" size="medium">#{demo.demoNumber}</Badge>
            ) : null}
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{updatedStr}</Caption1>
            {durationStr && (
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>⏱ {durationStr}</Caption1>
            )}
            {demo.clickPoints.length > 0 && (
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                👆 {MSG.demoDetailInfoSteps(demo.clickPoints.length)}
              </Caption1>
            )}
          </div>

          {/* Title */}
          <Text as="h1" size={700} weight="semibold" className={classes.heroTitle}>
            {demo.title}
          </Text>

          {/* Description */}
          <Body2 className={classes.heroDescription}>
            {demo.description || (
              <span style={{ color: tokens.colorNeutralForeground4 }}>
                {MSG.demoDetailNoDescription}
              </span>
            )}
          </Body2>

          {/* Stats row */}
          <div className={classes.heroStats}>
            <div className={classes.statItem}>
              <HeartRegular fontSize={16} />
              <Caption1>{likeCount} いいね</Caption1>
            </div>
            <div className={classes.statItem}>
              <span>▶</span>
              <Caption1>{demo.playCount ?? 0} 再生</Caption1>
            </div>
            <div className={classes.statItem}>
              <ChatRegular fontSize={16} />
              <Caption1>{comments.length} コメント</Caption1>
            </div>
          </div>

          {/* Action buttons */}
          <div className={classes.heroActions}>
            <Button
              appearance="primary"
              size="large"
              icon={<PlayRegular />}
              onClick={() => navigate(`/player/${demo.id}`)}
            >
              {MSG.demoDetailPlay}
            </Button>

            <Tooltip
              content={isLiked ? MSG.unlike : MSG.like}
              relationship="label"
            >
              <Button
                appearance={isLiked ? 'primary' : 'secondary'}
                icon={isLiked ? <HeartFilled /> : <HeartRegular />}
                onClick={handleLikeToggle}
              >
                {likeCount > 0 ? likeCount : MSG.like}
              </Button>
            </Tooltip>

            <Tooltip
              content={isFavorited ? MSG.unfavorite : MSG.favorite}
              relationship="label"
            >
              <Button
                appearance={isFavorited ? 'primary' : 'secondary'}
                icon={isFavorited ? <BookmarkFilled /> : <BookmarkRegular />}
                onClick={handleFavoriteToggle}
              >
                {MSG.favorite}
              </Button>
            </Tooltip>

            {isDesigner && (
              <Button
                appearance="subtle"
                icon={<EditRegular />}
                onClick={() => navigate(`/designer/${demo.id}`)}
              >
                {MSG.demoDetailEdit}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={classes.tabArea}>
        <TabList
          selectedValue={activeTab}
          onTabSelect={handleTabSelect}
          size="large"
        >
          <Tab value="comments" icon={<ChatRegular />}>
            {MSG.demoDetailTabComments}
            {comments.length > 0 && (
              <Badge appearance="filled" size="small" style={{ marginLeft: '6px' }}>
                {comments.length}
              </Badge>
            )}
          </Tab>
          <Tab value="stats" icon={<DataBarVerticalRegular />}>
            {MSG.demoDetailTabStats}
          </Tab>
        </TabList>
        <Divider />

        {/* ── コメントタブ ─────────────────────────────── */}
        {activeTab === 'comments' && (
          <div className={classes.tabPanel}>
            {/* Comment form */}
            <div className={classes.commentForm}>
              <Textarea
                ref={textareaRef}
                placeholder={MSG.demoDetailCommentPlaceholder}
                value={commentText}
                onChange={(_, data) => setCommentText(data.value)}
                className={classes.commentTextarea}
                resize="vertical"
              />
              <div className={classes.commentFormActions}>
                <Button
                  appearance="primary"
                  disabled={!commentText.trim() || commentPosting}
                  onClick={handlePostComment}
                >
                  {commentPosting ? MSG.demoDetailCommentPosting : MSG.demoDetailCommentPost}
                </Button>
              </div>
            </div>

            {/* Comment list */}
            {comments.length === 0 ? (
              <div className={classes.noData}>
                <Text size={400} style={{ color: tokens.colorNeutralForeground3 }}>
                  {MSG.demoDetailCommentEmpty}
                </Text>
              </div>
            ) : (
              <div className={classes.commentList}>
                {comments.map((c) => (
                  <div key={c.id} className={classes.commentItem}>
                    <Avatar name={c.creatorName} size={36} icon={<PersonRegular />} />
                    <div className={classes.commentContent}>
                      <div className={classes.commentHeader}>
                        <Body1><strong>{c.creatorName}</strong></Body1>
                        <Caption1 className={classes.commentDate}>
                          {new Date(c.createdAt).toLocaleString('ja-JP', {
                            year: 'numeric', month: 'numeric', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </Caption1>
                        {selectedCreator?.id === c.creatorId && (
                          <Tooltip content={MSG.demoDetailCommentDeleteConfirm} relationship="label">
                            <Button
                              appearance="subtle"
                              icon={<DeleteRegular />}
                              size="small"
                              style={{ marginLeft: 'auto' }}
                              onClick={() => handleDeleteComment(c.id)}
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
          </div>
        )}

        {/* ── 統計タブ ──────────────────────────────────── */}
        {activeTab === 'stats' && (
          <div className={classes.tabPanel}>
            {statsLoading ? (
              <div className={classes.spinnerArea}>
                <Spinner label="統計を読み込んでいます..." />
              </div>
            ) : !stats ? (
              <div className={classes.noData}>
                <Text size={400} style={{ color: tokens.colorNeutralForeground3 }}>
                  {MSG.demoDetailStatsNoData}
                </Text>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div className={classes.statsGrid}>
                  <StatCard value={stats.playCount} label={MSG.demoDetailStatsTotalPlays} color="#0078D4" />
                  <StatCard value={stats.completionCount} label={MSG.demoDetailStatsCompletions} color="#107C10" />
                  <StatCard value={`${stats.completionRate}%`} label={MSG.demoDetailStatsRate} color="#8764B8" />
                  <StatCard value={stats.likeCount} label={MSG.demoDetailStatsLikes} color="#D13438" />
                  <StatCard value={stats.commentCount} label="コメント数" color="#CA5010" />
                </div>

                {/* Daily plays chart */}
                <div className={classes.chartSection}>
                  <Text as="h3" size={500} weight="semibold" className={classes.chartTitle}>
                    {MSG.demoDetailStatsDailyTitle}
                  </Text>
                  <div className={classes.chartContainer}>
                    {stats.dailyPlays.every((d) => d.views === 0) ? (
                      <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                        {MSG.demoDetailStatsNoData}
                      </Caption1>
                    ) : (
                      <DailyBarChart data={stats.dailyPlays} />
                    )}
                  </div>
                </div>

                {/* Top sites */}
                {stats.topSites.length > 0 && (
                  <div className={classes.chartSection}>
                    <Text as="h3" size={500} weight="semibold" className={classes.chartTitle}>
                      {MSG.demoDetailStatsSitesTitle}
                    </Text>
                    <div className={classes.chartContainer}>
                      <HorizontalBarChart
                        data={stats.topSites.map((s) => ({ label: s.site, value: s.count }))}
                        color="#0078D4"
                      />
                    </div>
                  </div>
                )}

                {/* Role breakdown */}
                {stats.roleBreakdown.length > 0 && (
                  <div className={classes.chartSection}>
                    <Text as="h3" size={500} weight="semibold" className={classes.chartTitle}>
                      {MSG.demoDetailStatsRoleTitle}
                    </Text>
                    <div className={classes.chartContainer}>
                      <HorizontalBarChart
                        data={stats.roleBreakdown.map((r) => ({
                          label:
                            r.role === 'designer'
                              ? 'デザイナー'
                              : r.role === 'viewer'
                              ? 'ビューアー'
                              : '不明',
                          value: r.count,
                        }))}
                        color="#8764B8"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** 統計サマリーカード */
function StatCard({
  value,
  label,
  color,
}: {
  value: number | string;
  label: string;
  color: string;
}) {
  const classes = useStyles();
  return (
    <Card className={classes.statCard}>
      <span className={classes.statCardValue} style={{ color }}>
        {value}
      </span>
      <Caption1 className={classes.statCardLabel}>{label}</Caption1>
    </Card>
  );
}
