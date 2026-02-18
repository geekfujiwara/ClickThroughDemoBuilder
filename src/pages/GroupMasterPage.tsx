import { useEffect, useState, useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Text,
  Input,
  Button,
  Spinner,
} from '@fluentui/react-components';
import * as groupService from '@/services/groupService';
import { useProjectStore } from '@/stores/projectStore';
import { MSG } from '@/constants/messages';
import type { DemoGroup } from '@/types';

const useStyles = makeStyles({
  header: {
    marginBottom: tokens.spacingVerticalL,
  },
  createRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: tokens.spacingVerticalM,
  },
  groupInput: {
    minWidth: '240px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  row: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
    flexWrap: 'wrap',
    padding: tokens.spacingVerticalS,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  rowInput: {
    minWidth: '220px',
  },
});

export default function GroupMasterPage() {
  const classes = useStyles();
  const { projects, loadProjects, updateProject } = useProjectStore();
  const [groups, setGroups] = useState<DemoGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupEdits, setGroupEdits] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadGroups = useCallback(async () => {
    try {
      setIsLoading(true);
      const all = await groupService.getAllGroups();
      setGroups(all);
      const next: Record<string, string> = {};
      for (const group of all) {
        next[group.id] = group.name;
      }
      setGroupEdits(next);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
    void loadProjects();
  }, [loadGroups, loadProjects]);

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

      const targets = projects.filter((p) => p.groupId === group.id);
      for (const project of targets) {
        await updateProject(project.id, { groupId: undefined });
      }

      await loadGroups();
    } catch (e) {
      alert((e as Error).message);
    }
  }, [projects, updateProject, loadGroups]);

  return (
    <>
      <div className={classes.header}>
        <Text as="h1" size={700} weight="semibold">
          {MSG.projectsGroupMaster}
        </Text>
      </div>

      <div className={classes.createRow}>
        <Input
          className={classes.groupInput}
          value={newGroupName}
          placeholder={MSG.projectsGroupNamePlaceholder}
          onChange={(_, data) => setNewGroupName(data.value)}
        />
        <Button appearance="primary" onClick={handleCreateGroup}>
          {MSG.projectsGroupCreate}
        </Button>
      </div>

      {isLoading ? (
        <Spinner label={MSG.loading} />
      ) : (
        <div className={classes.list}>
          {groups.map((group) => (
            <div key={group.id} className={classes.row}>
              <Input
                className={classes.rowInput}
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
      )}
    </>
  );
}
