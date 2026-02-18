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
  Tooltip,
  Spinner,
  Label,
} from '@fluentui/react-components';
import {
  PlayRegular,
  EditRegular,
  CopyRegular,
  DeleteRegular,
  SearchRegular,
  AddRegular,
  ArrowExportRegular,
  FolderArrowRightRegular,
} from '@fluentui/react-icons';

import EmptyState from '@/components/common/EmptyState';
import SkeletonCard from '@/components/common/SkeletonCard';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useProjectStore } from '@/stores/projectStore';
import { exportDemoToFolder, exportAllDemosToFolder } from '@/services/exportService';
import * as groupService from '@/services/groupService';
import { MSG } from '@/constants/messages';
import type { DemoGroup, DemoProject } from '@/types';

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
  groupMaster: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalS,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  groupMasterHeader: {
    marginBottom: tokens.spacingVerticalXS,
  },
  groupCreateRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  groupInput: {
    minWidth: '200px',
  },
  groupList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  groupRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  groupNameInput: {
    minWidth: '180px',
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

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupEdits, setGroupEdits] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [deleteTarget, setDeleteTarget] = useState<DemoProject | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState('');

  /** 説明文を最大長で切り詰める */
  const truncate = (text: string, max = 80) =>
    text.length > max ? text.slice(0, max) + '…' : text;

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void (async () => {
      try {
        const all = await groupService.getAllGroups();
        setGroups(all);
        const init: Record<string, string> = {};
        for (const group of all) {
          init[group.id] = group.name;
        }
        setGroupEdits(init);
      } catch {
        setGroups([]);
      }
    })();
  }, []);

  // フィルタ + ソート
  const filtered = projects
    .filter((p) => {
      const q = search.toLowerCase();
      const hitKeyword = p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      const hitGroup = groupFilter === 'all' ? true : (groupFilter === 'none' ? !p.groupId : p.groupId === groupFilter);
      return hitKeyword && hitGroup;
    })
    .sort((a, b) => {
      if (sortKey === 'title') return a.title.localeCompare(b.title, 'ja');
      return new Date(b[sortKey]).getTime() - new Date(a[sortKey]).getTime();
    });

  /** 個別エクスポート */
  const handleExportSingle = useCallback(async (project: DemoProject) => {
    try {
      setExportingId(project.id);
      await exportDemoToFolder(project);
    } catch {
      // ユーザーがダイアログをキャンセルした場合など
    } finally {
      setExportingId(null);
    }
  }, []);

  /** 一括エクスポート */
  const handleExportAll = useCallback(async () => {
    const targets = filtered.filter((p) => p.video);
    if (targets.length === 0) return;
    try {
      setBulkExporting(true);
      setBulkProgress(MSG.exportAllProgress(0, targets.length));
      const count = await exportAllDemosToFolder(targets, (done, total) => {
        setBulkProgress(MSG.exportAllProgress(done, total));
      });
      setBulkProgress('');
      alert(MSG.exportAllSuccess(count));
    } catch {
      // ユーザーがダイアログをキャンセルした場合など
    } finally {
      setBulkExporting(false);
      setBulkProgress('');
    }
  }, [filtered]);

  const handleDelete = useCallback(async () => {
    if (deleteTarget) {
      await deleteProject(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteProject]);

  const loadGroups = useCallback(async () => {
    const all = await groupService.getAllGroups();
    setGroups(all);
    const init: Record<string, string> = {};
    for (const group of all) {
      init[group.id] = group.name;
    }
    setGroupEdits(init);
  }, []);

  const handleCreateGroup = useCallback(async () => {
    const name = newGroupName.trim();
    if (!name) return;
    try {
      await groupService.createGroup(name);
      setNewGroupName('');
      await loadGroups();
    } catch (e) {
      alert((e as Error).message);
    }
  }, [newGroupName, loadGroups]);

  const handleSaveGroup = useCallback(async (groupId: string) => {
    const name = (groupEdits[groupId] ?? '').trim();
    if (!name) return;
    try {
      await groupService.updateGroup(groupId, name);
      await loadGroups();
    } catch (e) {
      alert((e as Error).message);
    }
  }, [groupEdits, loadGroups]);

  const handleDeleteGroup = useCallback(async (group: DemoGroup) => {
    if (!confirm(MSG.projectsGroupDeleteConfirm(group.name))) return;
    try {
      await groupService.deleteGroup(group.id);
      await loadGroups();

      const targets = projects.filter((p) => p.groupId === group.id);
      for (const project of targets) {
        await updateProject(project.id, { groupId: undefined });
      }
      if (groupFilter === group.id) {
        setGroupFilter('all');
      }
    } catch (e) {
      alert((e as Error).message);
    }
  }, [groupFilter, loadGroups, projects, updateProject]);

  const handleAssignGroup = useCallback(async (projectId: string, value: string) => {
    await updateProject(projectId, { groupId: value || undefined });
  }, [updateProject]);

  const groupMap = new Map(groups.map((g) => [g.id, g.name]));

  return (
    <>
      {/* ヘッダー */}
      <div className={classes.header}>
        <Text as="h1" size={700} weight="semibold">
          {MSG.projectsTitle}
        </Text>
        <Button
          appearance="primary"
          icon={<AddRegular />}
          onClick={() => navigate('/designer')}
        >
          {MSG.projectsNew}
        </Button>
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
          value={sortKey}
          onChange={(_, data) => setSortKey(data.value as SortKey)}
        >
          <option value="updatedAt">{MSG.projectsSortUpdated}</option>
          <option value="createdAt">{MSG.projectsSortCreated}</option>
          <option value="title">{MSG.projectsSortTitle}</option>
        </Select>

        <Tooltip content={bulkProgress || MSG.exportAll} relationship="label">
          <Button
            icon={bulkExporting ? <Spinner size="tiny" /> : <ArrowExportRegular />}
            appearance="subtle"
            disabled={bulkExporting || filtered.length === 0}
            onClick={handleExportAll}
          >
            {bulkProgress || MSG.exportAll}
          </Button>
        </Tooltip>
      </div>

      <section className={classes.groupMaster}>
        <Text as="h3" weight="semibold" className={classes.groupMasterHeader}>{MSG.projectsGroupMaster}</Text>
        <div className={classes.groupCreateRow}>
          <Input
            className={classes.groupInput}
            value={newGroupName}
            placeholder={MSG.projectsGroupNamePlaceholder}
            onChange={(_, data) => setNewGroupName(data.value)}
          />
          <Button appearance="primary" onClick={handleCreateGroup}>{MSG.projectsGroupCreate}</Button>
        </div>
        <div className={classes.groupList}>
          {groups.map((group) => (
            <div key={group.id} className={classes.groupRow}>
              <Input
                className={classes.groupNameInput}
                value={groupEdits[group.id] ?? group.name}
                onChange={(_, data) => setGroupEdits((prev) => ({ ...prev, [group.id]: data.value }))}
              />
              <Button size="small" appearance="subtle" onClick={() => void handleSaveGroup(group.id)}>
                {MSG.projectsGroupSave}
              </Button>
              <Button size="small" appearance="subtle" onClick={() => void handleDeleteGroup(group)}>
                {MSG.delete}
              </Button>
            </div>
          ))}
        </div>
      </section>

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
                <Button
                  icon={<EditRegular />}
                  size="small"
                  appearance="subtle"
                  onClick={() => navigate(`/designer/${project.id}`)}
                >
                  編集
                </Button>
                <Tooltip content={MSG.exportDemo} relationship="label">
                  <Button
                    icon={exportingId === project.id ? <Spinner size="tiny" /> : <FolderArrowRightRegular />}
                    size="small"
                    appearance="subtle"
                    disabled={!project.video || exportingId !== null}
                    onClick={() => handleExportSingle(project)}
                  >
                    {MSG.exportDemo}
                  </Button>
                </Tooltip>
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
