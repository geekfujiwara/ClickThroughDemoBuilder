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
  Body1,
  Caption1,
  Input,
  Select,
  Badge,
  Label,
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
} from '@fluentui/react-icons';

import EmptyState from '@/components/common/EmptyState';
import SkeletonCard from '@/components/common/SkeletonCard';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';
import * as groupService from '@/services/groupService';
import * as creatorService from '@/services/creatorService';
import {
  addLike, removeLike, getLikeStatus,
  getFavorites, addFavorite, removeFavorite,
} from '@/services/socialService';
import { MSG } from '@/constants/messages';
import type { DemoCreator, DemoGroup, DemoProject } from '@/types';

type SortKey = 'updatedAt' | 'createdAt' | 'title';

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
});

export default function ProjectsPage() {
  const classes = useStyles();
  const navigate = useNavigate();
  const { projects, isLoading, loadProjects, deleteProject, duplicateProject, updateProject } =
    useProjectStore();
  const { role } = useAuthStore();
  const isDesigner = role === 'designer';

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

  /** 説明文を最大長で切り詰める */
  const truncate = (text: string, max = 80) =>
    text.length > max ? text.slice(0, max) + '…' : text;

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Load favorites on mount
  useEffect(() => {
    getFavorites()
      .then((favs) => {
        setFavoritedDemos(new Set(favs.map((f) => f.demoId)));
      })
      .catch(() => {/* not authenticated - ignore */});
  }, []);

  // Load like status for visible projects
  useEffect(() => {
    projects.forEach((p) => {
      getLikeStatus(p.id)
        .then((res) => {
          setLikedDemos((prev) => {
            const next = new Set(prev);
            if (res.liked) next.add(p.id); else next.delete(p.id);
            return next;
          });
          setLikeCounts((prev) => ({ ...prev, [p.id]: res.count }));
        })
        .catch(() => {/* ignore */});
    });
  }, [projects]);

  const handleLikeToggle = useCallback(async (id: string) => {
    const isLiked = likedDemos.has(id);
    try {
      if (isLiked) {
        await removeLike(id);
        setLikedDemos((prev) => { const s = new Set(prev); s.delete(id); return s; });
        setLikeCounts((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 1) - 1) }));
      } else {
        await addLike(id);
        setLikedDemos((prev) => new Set(prev).add(id));
        setLikeCounts((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
      }
    } catch { /* ignore */ }
  }, [likedDemos]);

  const handleFavoriteToggle = useCallback(async (id: string) => {
    const isFav = favoritedDemos.has(id);
    try {
      if (isFav) {
        await removeFavorite(id);
        setFavoritedDemos((prev) => { const s = new Set(prev); s.delete(id); return s; });
      } else {
        await addFavorite(id);
        setFavoritedDemos((prev) => new Set(prev).add(id));
      }
    } catch { /* ignore */ }
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

  const handleAssignGroup = useCallback(async (projectId: string, value: string) => {
    await updateProject(projectId, { groupId: value || undefined });
  }, [updateProject]);

  const handleAssignCreator = useCallback(async (projectId: string, value: string) => {
    await updateProject(projectId, { creatorId: value || undefined });
  }, [updateProject]);

  const groupMap = new Map(groups.map((g) => [g.id, g.name]));
  const creatorMap = new Map(creators.map((c) => [c.id, c.name]));

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

      {/* ツールバー */}
      <div className={classes.toolbar}>
        <Input
          className={classes.searchInput}
          contentBefore={<SearchRegular />}
          placeholder={MSG.projectsSearch}
          value={search}
          onChange={(_, data) => setSearch(data.value)}
        />
        <Select
          className={classes.groupFilter}
          value={groupFilter}
          onChange={(_, data) => setGroupFilter(data.value)}
        >
          <option value="all">{MSG.projectsGroupAll}</option>
          <option value="none">{MSG.projectsNoGroup}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </Select>
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
            <Card key={project.id} className={classes.card}>
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
                    <div className={classes.groupTag}>
                      <Caption1>
                        {MSG.projectsGroupFilter}: {project.groupId ? (groupMap.get(project.groupId) ?? MSG.projectsNoGroup) : MSG.projectsNoGroup}
                      </Caption1>
                      <Caption1>
                        {MSG.projectsCreatorFilter}: {project.creatorId ? (creatorMap.get(project.creatorId) ?? MSG.projectsNoCreator) : MSG.projectsNoCreator}
                      </Caption1>
                    </div>
                  </>
                }
              />
              <CardFooter className={classes.cardActions}>
                <Button
                  icon={<PlayRegular />}
                  size="small"
                  onClick={() => navigate(`/player/${project.id}`)}
                >
                  再生
                </Button>
                {isDesigner && (
                  <>
                    <Button
                      icon={<EditRegular />}
                      size="small"
                      appearance="subtle"
                      onClick={() => navigate(`/designer/${project.id}`)}
                    >
                      編集
                    </Button>
                    <Button
                      icon={<CopyRegular />}
                      size="small"
                      appearance="subtle"
                      onClick={() => duplicateProject(project.id)}
                    >
                      複製
                    </Button>
                    <Button
                      icon={<DeleteRegular />}
                      size="small"
                      appearance="subtle"
                      onClick={() => setDeleteTarget(project)}
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
                      onClick={() => void handleLikeToggle(project.id)}
                    >
                      {likeCounts[project.id] ?? project.likeCount ?? 0}
                    </Button>
                  </Tooltip>
                  <Tooltip content={favoritedDemos.has(project.id) ? MSG.unfavorite : MSG.favorite} relationship="label">
                    <Button
                      icon={favoritedDemos.has(project.id) ? <BookmarkFilled style={{ color: 'goldenrod' }} /> : <BookmarkRegular />}
                      size="small"
                      appearance="subtle"
                      onClick={() => void handleFavoriteToggle(project.id)}
                    />
                  </Tooltip>
                </div>
                {isDesigner && (
                  <>
                    <div>
                      <Label>{MSG.projectsGroupFilter}</Label>
                      <Select
                        value={project.groupId ?? ''}
                        onChange={(_, data) => void handleAssignGroup(project.id, data.value)}
                      >
                        <option value="">{MSG.projectsNoGroup}</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label>{MSG.projectsCreatorFilter}</Label>
                      <Select
                        value={project.creatorId ?? ''}
                        onChange={(_, data) => void handleAssignCreator(project.id, data.value)}
                      >
                        <option value="">{MSG.projectsNoCreator}</option>
                        {creators.map((creator) => (
                          <option key={creator.id} value={creator.id}>{creator.name}</option>
                        ))}
                      </Select>
                    </div>
                  </>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

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
