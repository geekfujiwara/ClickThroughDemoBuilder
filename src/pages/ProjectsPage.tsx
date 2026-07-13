import { useEffect, useState, useCallback, useRef } from 'react';
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
  Input,
  Select,
  Badge,
  Tooltip,
} from '@fluentui/react-components';
import {
  PlayRegular,
  EditRegular,
  CopyRegular,
  DeleteRegular,
  SearchRegular,
  AddRegular,
  HeartRegular,
  HeartFilled,
  BookmarkRegular,
  BookmarkFilled,
  InfoRegular,
} from '@fluentui/react-icons';

import EmptyState from '@/components/common/EmptyState';
import SkeletonCard from '@/components/common/SkeletonCard';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import { apiGet } from '@/services/apiClient';
import { useGuestNavigate } from '@/hooks/useGuestNav';
import * as groupService from '@/services/groupService';
import * as creatorService from '@/services/creatorService';
import {
  addLike, removeLike,
  getMyLikes,
  getFavorites, addFavorite, removeFavorite,
} from '@/services/socialService';
import { useMsg } from '@/hooks/useMsg';
import type { DemoCreator, DemoGroup, DemoProject } from '@/types';

type SortKey = 'updatedAt' | 'createdAt' | 'title';

/** hex カラーが明るい色かどうかを判定 */
function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // 相対輝度 (ITU-R BT.709)
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 128;
}

const useStyles = makeStyles({
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalXXL,
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalL,
    flexWrap: 'wrap',
  },
  searchInput: {
    minWidth: '240px',
  },
  groupFilter: {
    minWidth: '220px',
  },
  groupTag: {
    marginTop: tokens.spacingVerticalXXS,
  },
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginTop: tokens.spacingVerticalXXS,
  },
  colorBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: tokens.borderRadiusSmall,
    padding: '2px 8px',
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: '18px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: tokens.spacingHorizontalL,
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
    ':hover': {
      boxShadow: tokens.shadow8,
    },
  },
  cardActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    flexWrap: 'wrap',
  },
  socialActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    marginLeft: 'auto',
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  cardDescription: {
    marginTop: tokens.spacingVerticalXXS,
    color: tokens.colorNeutralForeground3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
  },
  // ── 左サイドメニュー（検索・組織フィルター） ──
  layout: {
    display: 'grid',
    gridTemplateColumns: '260px minmax(0, 1fr)',
    gap: tokens.spacingHorizontalXL,
    alignItems: 'start',
    '@media (max-width: 768px)': { gridTemplateColumns: '1fr' },
  },
  sidebar: {
    position: 'sticky',
    top: tokens.spacingVerticalL,
    display: 'flex', flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    '@media (max-width: 768px)': { position: 'static' },
  },
  sidebarSection: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalXS },
  sidebarTitle: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    marginBottom: tokens.spacingVerticalXXS,
  },
  orgList: { display: 'flex', flexDirection: 'column', gap: '2px' },
  orgButton: {
    justifyContent: 'space-between',
    width: '100%',
    minWidth: 0,
    fontWeight: tokens.fontWeightRegular,
  },
  orgName: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  orgCount: { opacity: 0.75, fontVariantNumeric: 'tabular-nums', marginLeft: tokens.spacingHorizontalS, flexShrink: 0 },
  mainCol: { minWidth: 0 },
});

/** /api/demos が返すサマリー型 */
interface DemoSummary {
  id: string;
  demoNumber: number;
  title: string;
  description: string;
  groupId?: string;
  creatorId?: string;
  thumbnailDataUrl: string;
  clickPointCount: number;
  duration: number;
  updatedAt: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  playCount: number;
}

export default function ProjectsPage() {
  const MSG = useMsg();
  const classes = useStyles();
  const navigate = useGuestNavigate();
  const { projects: storeProjects, isLoading: storeLoading, loadProjects, deleteProject, duplicateProject } =
    useProjectStore();
  const { role, isGuest } = useAuthStore();
  const isDesigner = role === 'designer' || role === 'user_admin' || role === 'system_admin';

  // viewer ロールはプロジェクトページにアクセス不可 → ホームへリダイレクト
  // ただしゲストユーザーはデモ閲覧のためアクセス許可
  useEffect(() => {
    if (role && !isDesigner && !isGuest) {
      navigate('/', { replace: true });
    }
  }, [role, isDesigner, isGuest, navigate]);

  // Viewer/ゲスト用: /api/demos から取得したデモ一覧
  const [viewerDemos, setViewerDemos] = useState<DemoProject[]>([]);
  const [viewerLoading, setViewerLoading] = useState(false);

  // isDesigner に応じてデータソースを切り替え
  const projects = isDesigner ? storeProjects : viewerDemos;
  const isLoading = isDesigner ? storeLoading : viewerLoading;

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [creators, setCreators] = useState<DemoCreator[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [deleteTarget, setDeleteTarget] = useState<DemoProject | null>(null);

  // Social state
  const [likedDemos, setLikedDemos] = useState<Set<string>>(new Set());
  const [favoritedDemos, setFavoritedDemos] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  // ユーザーが明示的に操作したIDを記録し、非同期レスポンスによる上書きを防ぐ
  const userToggledLikes = useRef<Set<string>>(new Set());
  const userToggledFavs = useRef<Set<string>>(new Set());

  /** 説明文を最大長で切り詰める */
  const truncate = (text: string, max = 80) =>
    text.length > max ? text.slice(0, max) + '…' : text;

  useEffect(() => {
    if (isDesigner) {
      loadProjects();
    } else {
      // Viewer/ゲスト: /api/demos (viewer ロール対応) からロード
      setViewerLoading(true);
      apiGet<DemoSummary[]>('/demos')
        .then((demos) => {
          // DemoProject 互換の形状に変換
          setViewerDemos(
            demos.map((d) => ({
              ...d,
              video: { thumbnailDataUrl: d.thumbnailDataUrl } as DemoProject['video'],
              clickPoints: Array.from({ length: d.clickPointCount }) as DemoProject['clickPoints'],
              settings: {},
            }) as unknown as DemoProject),
          );
        })
        .catch(() => setViewerDemos([]))
        .finally(() => setViewerLoading(false));
    }
  }, [isDesigner, loadProjects]);

  // Load favorites on mount
  useEffect(() => {
    getFavorites()
      .then((favs) => {
        setFavoritedDemos((prev) => {
          const next = new Set(favs.map((f) => f.demoId));
          // ユーザーが既にトグルしたIDは prev の状態を維持し上書きしない
          for (const id of userToggledFavs.current) {
            if (prev.has(id)) next.add(id); else next.delete(id);
          }
          return next;
        });
      })
      .catch(() => {/* not authenticated - ignore */});
  }, []);

  // 自分のいいね一覧を一括取得（お気に入りと同様の単一呼び出しパターン）
  useEffect(() => {
    getMyLikes()
      .then((likedIds) => {
        setLikedDemos((prev) => {
          const next = new Set(likedIds);
          // ユーザーが既にトグルしたIDは prev の状態を維持し上書きしない
          for (const id of userToggledLikes.current) {
            if (prev.has(id)) next.add(id); else next.delete(id);
          }
          return next;
        });
      })
      .catch(() => {/* not authenticated - ignore */});
  }, []);

  const handleLikeToggle = useCallback(async (id: string) => {
    const isLiked = likedDemos.has(id);
    // ユーザー操作として記録（非同期レスポンスによる上書きを防止）
    userToggledLikes.current.add(id);
    // 楽観的更新: API 呼び出し前に UI を即反映
    if (isLiked) {
      setLikedDemos((prev) => { const s = new Set(prev); s.delete(id); return s; });
      setLikeCounts((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 1) - 1) }));
    } else {
      setLikedDemos((prev) => new Set(prev).add(id));
      setLikeCounts((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
    }
    try {
      if (isLiked) {
        await removeLike(id);
      } else {
        await addLike(id);
      }
    } catch {
      // エラー時はロールバック
      if (isLiked) {
        setLikedDemos((prev) => new Set(prev).add(id));
        setLikeCounts((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
      } else {
        setLikedDemos((prev) => { const s = new Set(prev); s.delete(id); return s; });
        setLikeCounts((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 1) - 1) }));
      }
    }
  }, [likedDemos]);

  const handleFavoriteToggle = useCallback(async (id: string) => {
    const isFav = favoritedDemos.has(id);
    // ユーザー操作として記録（非同期レスポンスによる上書きを防止）
    userToggledFavs.current.add(id);
    // 楽観的更新: API 呼び出し前に UI を即反映
    if (isFav) {
      setFavoritedDemos((prev) => { const s = new Set(prev); s.delete(id); return s; });
    } else {
      setFavoritedDemos((prev) => new Set(prev).add(id));
    }
    try {
      if (isFav) {
        await removeFavorite(id);
      } else {
        await addFavorite(id);
      }
    } catch {
      // エラー時はロールバック
      if (isFav) {
        setFavoritedDemos((prev) => new Set(prev).add(id));
      } else {
        setFavoritedDemos((prev) => { const s = new Set(prev); s.delete(id); return s; });
      }
    }
  }, [favoritedDemos]);

  // フィルタ + ソート
  const filtered = projects
    .filter((p) => {
      const q = search.toLowerCase();
      const hitKeyword = p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      const hitGroup = groupFilter === 'all' ? true : (groupFilter === 'none' ? !p.groupId : p.groupId === groupFilter);
      const hitCreator = creatorFilter === 'all' ? true : (creatorFilter === 'none' ? !p.creatorId : p.creatorId === creatorFilter);
      return hitKeyword && hitGroup && hitCreator;
    })
    .sort((a, b) => {
      if (sortKey === 'title') return a.title.localeCompare(b.title, 'ja');
      return new Date(b[sortKey]).getTime() - new Date(a[sortKey]).getTime();
    });

  const handleDelete = useCallback(async () => {
    if (deleteTarget) {
      await deleteProject(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteProject]);

  // 組織ごとの件数（検索・作成者フィルタ適用後、組織フィルタ自体は除外）
  const orgFilteredBase = projects.filter((p) => {
    const q = search.toLowerCase();
    const hitKeyword = p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    const hitCreator = creatorFilter === 'all' ? true : (creatorFilter === 'none' ? !p.creatorId : p.creatorId === creatorFilter);
    return hitKeyword && hitCreator;
  });
  const orgCounts = new Map<string, number>();
  let noGroupCount = 0;
  for (const p of orgFilteredBase) {
    if (p.groupId) orgCounts.set(p.groupId, (orgCounts.get(p.groupId) ?? 0) + 1);
    else noGroupCount++;
  }
  const totalDemoCount = orgFilteredBase.length;

  const loadGroups = useCallback(async () => {
    const all = await groupService.getAllGroups();
    setGroups(all);
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const loadCreators = useCallback(async () => {
    const all = await creatorService.getAllCreators();
    setCreators(all);
  }, []);

  useEffect(() => {
    void loadCreators();
  }, [loadCreators]);

  // id → オブジェクトマップ
  const groupObjects = new Map(groups.map((g) => [g.id, g]));
  const creatorObjects = new Map(creators.map((c) => [c.id, c]));

  return (
    <>
      {/* ヘッダー */}
      <div className={classes.header}>
        <Text as="h1" size={700} weight="semibold">
          {MSG.projectsTitle}
        </Text>
        {isDesigner && (
          <Button
            appearance="primary"
            icon={<AddRegular />}
            onClick={() => navigate('/designer')}
          >
            {MSG.projectsNew}
          </Button>
        )}
      </div>

      <div className={classes.layout}>
        {/* 左サイドメニュー: 検索・組織フィルター */}
        <aside className={classes.sidebar}>
          <div className={classes.sidebarSection}>
            <Input
              className={classes.searchInput}
              style={{ width: '100%' }}
              contentBefore={<SearchRegular />}
              placeholder={MSG.projectsSearch}
              value={search}
              onChange={(_, data) => setSearch(data.value)}
            />
          </div>

          <div className={classes.sidebarSection}>
            <Text className={classes.sidebarTitle}>{MSG.projectsGroupFilter}</Text>
            <div className={classes.orgList}>
              <Button
                appearance={groupFilter === 'all' ? 'primary' : 'subtle'}
                className={classes.orgButton}
                onClick={() => setGroupFilter('all')}
              >
                <span className={classes.orgName}>{MSG.projectsGroupAll}</span>
                <span className={classes.orgCount}>{totalDemoCount}</span>
              </Button>
              {groups.map((group) => {
                const count = orgCounts.get(group.id) ?? 0;
                return (
                  <Button
                    key={group.id}
                    appearance={groupFilter === group.id ? 'primary' : 'subtle'}
                    className={classes.orgButton}
                    disabled={count === 0}
                    onClick={() => setGroupFilter(group.id)}
                  >
                    <span className={classes.orgName}>{group.name}</span>
                    <span className={classes.orgCount}>{count}</span>
                  </Button>
                );
              })}
              {noGroupCount > 0 && (
                <Button
                  appearance={groupFilter === 'none' ? 'primary' : 'subtle'}
                  className={classes.orgButton}
                  onClick={() => setGroupFilter('none')}
                >
                  <span className={classes.orgName}>{MSG.projectsNoGroup}</span>
                  <span className={classes.orgCount}>{noGroupCount}</span>
                </Button>
              )}
            </div>
          </div>
        </aside>

        {/* メインカラム */}
        <div className={classes.mainCol}>
          {/* ツールバー: 作成者・並び替え */}
          <div className={classes.toolbar}>
            <Select
              className={classes.groupFilter}
              value={creatorFilter}
              onChange={(_, data) => setCreatorFilter(data.value)}
            >
              <option value="all">{MSG.projectsCreatorAll}</option>
              <option value="none">{MSG.projectsNoCreator}</option>
              {creators.map((creator) => (
                <option key={creator.id} value={creator.id}>{creator.name}</option>
              ))}
            </Select>
            <Select
              value={sortKey}
              onChange={(_, data) => setSortKey(data.value as SortKey)}
            >
              <option value="updatedAt">{MSG.projectsSortUpdated}</option>
              <option value="createdAt">{MSG.projectsSortCreated}</option>
              <option value="title">{MSG.projectsSortTitle}</option>
            </Select>
          </div>

      {/* コンテンツ */}
      {isLoading ? (
        <div className={classes.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={MSG.projectsEmptyTitle}
          actionLabel={MSG.projectsEmptyAction}
          onAction={() => navigate('/designer')}
        />
      ) : (
        <div className={classes.grid}>
          {filtered.map((project) => (
            <Card key={project.id} className={classes.card} onClick={() => navigate(`/demos/${project.id}`)}>
              {project.video?.thumbnailDataUrl ? (
                <img
                  src={project.video.thumbnailDataUrl}
                  alt={project.title}
                  className={classes.thumbnail}
                />
              ) : (
                <div className={classes.thumbnail} />
              )}
              <CardHeader
                header={
                  <div className={classes.cardTitleRow}>
                    {project.demoNumber ? (
                      <Badge appearance="outline" size="small">#{project.demoNumber}</Badge>
                    ) : null}
                    <Body1><strong>{project.title}</strong></Body1>
                  </div>
                }
                description={
                  <>
                    <Caption1>
                      {MSG.projectsSteps(project.clickPoints.length)} ・ 更新:{' '}
                      {new Date(project.updatedAt).toLocaleDateString('ja-JP')}
                    </Caption1>
                    {project.description ? (
                      <Caption1 className={classes.cardDescription}>
                        {truncate(project.description)}
                      </Caption1>
                    ) : null}
                    <div className={classes.badgeRow}>
                      {project.creatorId && creatorObjects.has(project.creatorId) && (() => {
                        const c = creatorObjects.get(project.creatorId!)!;
                        const bg = c.color ?? '#dde3ed';
                        const textColor = isLightColor(bg) ? '#111' : '#fff';
                        return (
                          <span className={classes.colorBadge} style={{ backgroundColor: bg, color: textColor }}>
                            {c.name}
                          </span>
                        );
                      })()}
                      {project.groupId && groupObjects.has(project.groupId) && (() => {
                        const g = groupObjects.get(project.groupId!)!;
                        const bg = g.color ?? '#e6f4ea';
                        const textColor = isLightColor(bg) ? '#111' : '#fff';
                        return (
                          <span className={classes.colorBadge} style={{ backgroundColor: bg, color: textColor }}>
                            {g.name}
                          </span>
                        );
                      })()}
                    </div>
                  </>
                }
              />
              <CardFooter className={classes.cardActions}>
                <Button
                  icon={<InfoRegular />}
                  size="small"
                  appearance="subtle"
                  onClick={(e) => { e.stopPropagation(); navigate(`/demos/${project.id}`); }}
                >
                  詳細
                </Button>
                <Button
                  icon={<PlayRegular />}
                  size="small"
                  onClick={(e) => { e.stopPropagation(); navigate(`/player/${project.id}`); }}
                >
                  再生
                </Button>
                {isDesigner && (
                  <>
                    <Button
                      icon={<EditRegular />}
                      size="small"
                      appearance="subtle"
                      onClick={(e) => { e.stopPropagation(); navigate(`/designer/${project.id}`); }}
                    >
                      編集
                    </Button>
                    <Button
                      icon={<CopyRegular />}
                      size="small"
                      appearance="subtle"
                      onClick={(e) => { e.stopPropagation(); duplicateProject(project.id); }}
                    >
                      複製
                    </Button>
                    <Button
                      icon={<DeleteRegular />}
                      size="small"
                      appearance="subtle"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(project); }}
                    >
                      削除
                    </Button>
                  </>
                )}
                {/* いいね / お気に入りボタン */}
                <div className={classes.socialActions}>
                  <Tooltip content={likedDemos.has(project.id) ? MSG.unlike : MSG.like} relationship="label">
                    <Button
                      icon={likedDemos.has(project.id) ? <HeartFilled style={{ color: 'red' }} /> : <HeartRegular />}
                      size="small"
                      appearance="subtle"
                      onClick={(e) => { e.stopPropagation(); void handleLikeToggle(project.id); }}
                    >
                      {likeCounts[project.id] ?? project.likeCount ?? 0}
                    </Button>
                  </Tooltip>
                  <Tooltip content={favoritedDemos.has(project.id) ? MSG.unfavorite : MSG.favorite} relationship="label">
                    <Button
                      icon={favoritedDemos.has(project.id) ? <BookmarkFilled style={{ color: 'goldenrod' }} /> : <BookmarkRegular />}
                      size="small"
                      appearance="subtle"
                      onClick={(e) => { e.stopPropagation(); void handleFavoriteToggle(project.id); }}
                    />
                  </Tooltip>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
        </div>
      </div>

      {/* 削除確認ダイアログ */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={MSG.delete}
        message={deleteTarget ? MSG.projectsDeleteConfirm(deleteTarget.title) : ''}
        confirmLabel={MSG.delete}
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
