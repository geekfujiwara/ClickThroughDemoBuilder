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
  Caption1,
  Body1,
  Body2,
  Tooltip,
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
import { getDemoStats, type DemoStats, type DailyPlay } from '@/services/statsService';
import type { DemoProject, DemoComment } from '@/types';
import { MSG } from '@/constants/messages';

// ── Styles ────────────────────────────────────────────────────

const useStyles = makeStyles({
  page: {
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalXXXL,
  },
  backButton: {
    marginBottom: tokens.spacingVerticalM,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '320px 1fr',
    gap: tokens.spacingHorizontalXXL,
    alignItems: 'start',
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr',
    },
  },
  // ── Left ──
  left: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  metaBadges: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  title: {
    lineHeight: '1.3',
  },
  description: {
    color: tokens.colorNeutralForeground2,
    whiteSpace: 'pre-wrap',
    lineHeight: '1.6',
  },
  descriptionEmpty: {
    color: tokens.colorNeutralForeground4,
    fontStyle: 'italic',
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalL,
    flexWrap: 'wrap',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground2,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: '16 / 9',
    objectFit: 'cover',
    borderRadius: tokens.borderRadiusLarge,
    display: 'block',
    backgroundColor: tokens.colorNeutralBackground3,
  },
  thumbnailPlaceholder: {
    width: '100%',
    aspectRatio: '16 / 9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusLarge,
    fontSize: '40px',
    color: tokens.colorNeutralForeground4,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
  },
  // ── Right ──
  right: {
    minWidth: 0,
  },
  divider: {
    height: '1px',
    backgroundColor: tokens.colorNeutralStroke2,
    marginBottom: tokens.spacingVerticalL,
  },
  tabPanel: {
    marginTop: tokens.spacingVerticalL,
  },
  // ── Comments ──
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
  // ── Stats ──
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalXXL,
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
  chartSection: {
    marginBottom: tokens.spacingVerticalXXL,
  },
  chartTitle: {
    marginBottom: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalXS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  chartWrap: {
    overflowX: 'auto',
  },
  hbarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalS,
    minHeight: '28px',
  },
  hbarLabel: {
    width: '180px',
    minWidth: '120px',
    flexShrink: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  hbarTrack: {
    flex: '1',
    height: '20px',
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralBackground3,
    overflow: 'hidden',
  },
  hbarFill: {
    height: '100%',
    borderRadius: tokens.borderRadiusSmall,
    transition: 'width 500ms ease',
  },
  hbarCount: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    minWidth: '28px',
    textAlign: 'right',
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

// ── Sub Components ────────────────────────────────────────────

function KpiCard({ value, label, color }: { value: number | string; label: string; color: string }) {
  const classes = useStyles();
  return (
    <div className={classes.kpiCard}>
      <span className={classes.kpiValue} style={{ color }}>{value}</span>
      <span className={classes.kpiLabel}>{label}</span>
    </div>
  );
}

function HBar({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const classes = useStyles();
  if (!data.length) return <Caption1 style={{ color: 'gray' }}>データなし</Caption1>;
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
          <Caption1 className={classes.hbarCount}>{d.value}</Caption1>
        </div>
      ))}
    </div>
  );
}

function DailyChart({ data }: { data: DailyPlay[] }) {
  const classes = useStyles();
  const W = 560;
  const H = 140;
  const PL = 28;
  const PB = 32;
  const PT = 12;
  const chartW = W - PL - 4;
  const chartH = H - PB - PT;
  const maxVal = Math.max(...data.map((d) => d.views), 1);
  const bgW = chartW / data.length;
  const bw = Math.max(3, Math.min(14, bgW * 0.36));
  const bGap = Math.max(1, bgW * 0.06);
  const VIEWS = '#0078D4';
  const COMP = '#107C10';
  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  return (
    <div className={classes.chartWrap}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', minWidth: '320px', height: '140px', display: 'block' }}
      >
        {yTicks.map((t) => {
          const y = PT + chartH - (t / maxVal) * chartH;
          return (
            <g key={t}>
              <line x1={PL} y1={y} x2={W - 2} y2={y} stroke="#e0e0e0" strokeWidth="1" strokeDasharray="3,3" />
              <text x={PL - 3} y={y + 4} textAnchor="end" fontSize="9" fill="#aaa">{t}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = PL + i * bgW + (bgW - bw * 2 - bGap) / 2;
          const vh = (d.views / maxVal) * chartH;
          const ch = (d.completions / maxVal) * chartH;
          const showLabel = i % 5 === 0 || i === data.length - 1;
          return (
            <g key={d.date}>
              <rect x={x} y={PT + chartH - vh} width={bw} height={vh} fill={VIEWS} rx="2" opacity="0.85">
                <title>{d.date}: 再生 {d.views}</title>
              </rect>
              <rect x={x + bw + bGap} y={PT + chartH - ch} width={bw} height={ch} fill={COMP} rx="2" opacity="0.85">
                <title>{d.date}: 完了 {d.completions}</title>
              </rect>
              {showLabel && (
                <text x={x + bw} y={PT + chartH + 14} textAnchor="middle" fontSize="8" fill="#aaa">
                  {d.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={PL} y1={PT + chartH} x2={W - 2} y2={PT + chartH} stroke="#ccc" strokeWidth="1" />
      </svg>
      <div className={classes.chartLegend}>
        <div className={classes.legendItem}>
          <div className={classes.legendDot} style={{ backgroundColor: VIEWS }} />
          <Caption1>再生開始</Caption1>
        </div>
        <div className={classes.legendItem}>
          <div className={classes.legendDot} style={{ backgroundColor: COMP }} />
          <Caption1>完了</Caption1>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────

export default function DemoDetailPage() {
  const { demoId } = useParams<{ demoId: string }>();
  const navigate = useNavigate();
  const classes = useStyles();
  const { role, selectedCreator } = useAuthStore();
  const isDesigner = role === 'designer';

  const [demo, setDemo] = useState<DemoProject | null>(null);
  const [demoLoading, setDemoLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [comments, setComments] = useState<DemoComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentPosting, setCommentPosting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [stats, setStats] = useState<DemoStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('comments');

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

  useEffect(() => {
    if (activeTab !== 'stats' || !demoId || stats !== null) return;
    setStatsLoading(true);
    getDemoStats(demoId)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [activeTab, demoId, stats]);

  const handleLikeToggle = useCallback(async () => {
    if (!demoId) return;
    const prev = isLiked;
    const prevCount = likeCount;
    setIsLiked(!prev);
    setLikeCount(prev ? prevCount - 1 : prevCount + 1);
    try { if (prev) await removeLike(demoId); else await addLike(demoId); }
    catch { setIsLiked(prev); setLikeCount(prevCount); }
  }, [demoId, isLiked, likeCount]);

  const handleFavoriteToggle = useCallback(async () => {
    if (!demoId) return;
    const prev = isFavorited;
    setIsFavorited(!prev);
    try { if (prev) await removeFavorite(demoId); else await addFavorite(demoId); }
    catch { setIsFavorited(prev); }
  }, [demoId, isFavorited]);

  const handlePostComment = useCallback(async () => {
    if (!demoId || !commentText.trim() || commentPosting) return;
    setCommentPosting(true);
    try {
      const newComment = await addComment(demoId, commentText.trim());
      setComments((prev) => [newComment, ...prev]);
      setCommentText('');
    } catch { /* ignore */ } finally { setCommentPosting(false); }
  }, [demoId, commentText, commentPosting]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!demoId || !confirm(MSG.demoDetailCommentDeleteConfirm)) return;
    try {
      await deleteComment(demoId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch { /* ignore */ }
  }, [demoId]);

  const handleTabSelect = useCallback((_: SelectTabEvent, data: SelectTabData) => {
    setActiveTab(data.value as string);
  }, []);

  // ── Loading / Error ──────

  if (demoLoading) {
    return (
      <div className={classes.spinnerArea}>
        <Spinner label={MSG.loading} size="large" />
      </div>
    );
  }

  if (!demo) {
    return (
      <div className={classes.noData}>
        <Text size={500} weight="semibold">デモが見つかりません</Text>
        <br />
        <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={() => navigate(-1)}>
          {MSG.demoDetailBack}
        </Button>
      </div>
    );
  }

  const durationStr = demo.video?.duration
    ? MSG.demoDetailInfoDuration(demo.video.duration) : null;

  return (
    <div className={classes.page}>
      {/* 戻るボタン */}
      <div className={classes.backButton}>
        <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={() => navigate(-1)}>
          {MSG.demoDetailBack}
        </Button>
      </div>

      <div className={classes.layout}>
        {/* ── 左カラム ───────────────────────────── */}
        <div className={classes.left}>
          {/* メタ情報 */}
          <div className={classes.metaBadges}>
            {demo.demoNumber ? (
              <Badge appearance="outline" size="medium">#{demo.demoNumber}</Badge>
            ) : null}
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
              {MSG.demoDetailInfoUpdated(new Date(demo.updatedAt).toLocaleDateString('ja-JP'))}
            </Caption1>
          </div>

          {/* タイトル */}
          <Text as="h2" size={600} weight="semibold" className={classes.title}>
            {demo.title}
          </Text>

          {/* 説明 */}
          {demo.description ? (
            <Body2 className={classes.description}>{demo.description}</Body2>
          ) : (
            <Body2 className={classes.descriptionEmpty}>{MSG.demoDetailNoDescription}</Body2>
          )}

          {/* 統計ミニ行 */}
          <div className={classes.statRow}>
            <div className={classes.statItem}>
              <HeartRegular fontSize={14} />
              <Caption1>{likeCount}</Caption1>
            </div>
            <div className={classes.statItem}>
              <PlayRegular fontSize={14} />
              <Caption1>{demo.playCount ?? 0}</Caption1>
            </div>
            <div className={classes.statItem}>
              <ChatRegular fontSize={14} />
              <Caption1>{comments.length}</Caption1>
            </div>
            {durationStr && (
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{durationStr}</Caption1>
            )}
            {demo.clickPoints.length > 0 && (
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                {MSG.demoDetailInfoSteps(demo.clickPoints.length)}
              </Caption1>
            )}
          </div>

          {/* サムネイル */}
          {demo.video?.thumbnailDataUrl ? (
            <img
              src={demo.video.thumbnailDataUrl}
              alt={demo.title}
              className={classes.thumbnail}
            />
          ) : (
            <div className={classes.thumbnailPlaceholder}>🎬</div>
          )}

          {/* アクションボタン */}
          <div className={classes.actions}>
            <Button
              appearance="primary"
              icon={<PlayRegular />}
              onClick={() => navigate(`/player/${demo.id}`)}
            >
              {MSG.demoDetailPlay}
            </Button>

            <Tooltip content={isLiked ? MSG.unlike : MSG.like} relationship="label">
              <Button
                appearance={isLiked ? 'primary' : 'secondary'}
                icon={isLiked ? <HeartFilled /> : <HeartRegular />}
                onClick={handleLikeToggle}
              >
                {likeCount > 0 ? String(likeCount) : MSG.like}
              </Button>
            </Tooltip>

            <Tooltip content={isFavorited ? MSG.unfavorite : MSG.favorite} relationship="label">
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

        {/* ── 右カラム ───────────────────────────── */}
        <div className={classes.right}>
          <TabList selectedValue={activeTab} onTabSelect={handleTabSelect} size="medium">
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
          <div className={classes.divider} />

          {/* コメントタブ */}
          {activeTab === 'comments' && (
            <div className={classes.tabPanel}>
              <div className={classes.commentForm}>
                <Textarea
                  ref={textareaRef}
                  placeholder={MSG.demoDetailCommentPlaceholder}
                  value={commentText}
                  onChange={(_, d) => setCommentText(d.value)}
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

              {comments.length === 0 ? (
                <div className={classes.noData}>
                  <Caption1>{MSG.demoDetailCommentEmpty}</Caption1>
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
                          {selectedCreator?.id === c.creatorId && (
                            <Tooltip content="削除" relationship="label">
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

          {/* 統計タブ */}
          {activeTab === 'stats' && (
            <div className={classes.tabPanel}>
              {statsLoading ? (
                <div className={classes.spinnerArea}><Spinner label="統計を読み込んでいます..." /></div>
              ) : !stats ? (
                <div className={classes.noData}><Caption1>{MSG.demoDetailStatsNoData}</Caption1></div>
              ) : (
                <>
                  {/* KPIカード */}
                  <div className={classes.kpiGrid}>
                    <KpiCard value={stats.playCount}            label={MSG.demoDetailStatsTotalPlays}  color="#0078D4" />
                    <KpiCard value={stats.completionCount}      label={MSG.demoDetailStatsCompletions} color="#107C10" />
                    <KpiCard value={`${stats.completionRate}%`} label={MSG.demoDetailStatsRate}        color="#8764B8" />
                    <KpiCard value={stats.likeCount}            label={MSG.demoDetailStatsLikes}       color="#D13438" />
                    <KpiCard value={stats.commentCount}         label="コメント数"                     color="#CA5010" />
                  </div>

                  {/* 日別再生 (直近30日) */}
                  <div className={classes.chartSection}>
                    <Text as="h4" size={400} weight="semibold" className={classes.chartTitle}>
                      {MSG.demoDetailStatsDailyTitle}
                    </Text>
                    {stats.dailyPlays.every((d) => d.views === 0) ? (
                      <Caption1 style={{ color: 'gray' }}>{MSG.demoDetailStatsNoData}</Caption1>
                    ) : (
                      <DailyChart data={stats.dailyPlays} />
                    )}
                  </div>

                  {/* ユーザー別 */}
                  {stats.byUser.length > 0 && (
                    <div className={classes.chartSection}>
                      <Text as="h4" size={400} weight="semibold" className={classes.chartTitle}>
                        ユーザー別アクセス数
                      </Text>
                      <HBar data={stats.byUser.map((u) => ({ label: u.name, value: u.count }))} color="#0078D4" />
                    </div>
                  )}

                  {/* 組織別 */}
                  {stats.byOrganization.length > 0 && (
                    <div className={classes.chartSection}>
                      <Text as="h4" size={400} weight="semibold" className={classes.chartTitle}>
                        組織別アクセス数
                      </Text>
                      <HBar data={stats.byOrganization.map((o) => ({ label: o.name, value: o.count }))} color="#107C10" />
                    </div>
                  )}

                  {/* 地域別 */}
                  {stats.topSites.length > 0 && (
                    <div className={classes.chartSection}>
                      <Text as="h4" size={400} weight="semibold" className={classes.chartTitle}>
                        {MSG.demoDetailStatsSitesTitle}
                      </Text>
                      <HBar data={stats.topSites.map((s) => ({ label: s.site, value: s.count }))} color="#CA5010" />
                    </div>
                  )}

                  {/* 役割別 */}
                  {stats.roleBreakdown.length > 0 && (
                    <div className={classes.chartSection}>
                      <Text as="h4" size={400} weight="semibold" className={classes.chartTitle}>
                        {MSG.demoDetailStatsRoleTitle}
                      </Text>
                      <HBar
                        data={stats.roleBreakdown.map((r) => ({
                          label: r.role === 'designer' ? 'デザイナー' : r.role === 'viewer' ? 'ビューアー' : '不明',
                          value: r.count,
                        }))}
                        color="#8764B8"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
