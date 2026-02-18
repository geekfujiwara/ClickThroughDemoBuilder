import { useEffect, useState, useCallback } from 'react';
import {
  makeStyles,
  tokens,
  Text,
  Input,
  Button,
  Spinner,
} from '@fluentui/react-components';
import * as creatorService from '@/services/creatorService';
import { useProjectStore } from '@/stores/projectStore';
import { MSG } from '@/constants/messages';
import type { DemoCreator } from '@/types';

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
  input: {
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
});

export default function CreatorMasterPage() {
  const classes = useStyles();
  const { projects, loadProjects, updateProject } = useProjectStore();
  const [creators, setCreators] = useState<DemoCreator[]>([]);
  const [newCreatorName, setNewCreatorName] = useState('');
  const [creatorEdits, setCreatorEdits] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadCreators = useCallback(async () => {
    try {
      setIsLoading(true);
      const all = await creatorService.getAllCreators();
      setCreators(all);
      const next: Record<string, string> = {};
      for (const creator of all) {
        next[creator.id] = creator.name;
      }
      setCreatorEdits(next);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCreators();
    void loadProjects();
  }, [loadCreators, loadProjects]);

  const handleCreateCreator = useCallback(async () => {
    const name = newCreatorName.trim();
    if (!name) return;
    try {
      await creatorService.createCreator(name);
      setNewCreatorName('');
      await loadCreators();
    } catch (e) {
      alert((e as Error).message);
    }
  }, [newCreatorName, loadCreators]);

  const handleSaveCreator = useCallback(async (creatorId: string) => {
    const name = (creatorEdits[creatorId] ?? '').trim();
    if (!name) return;
    try {
      await creatorService.updateCreator(creatorId, name);
      await loadCreators();
    } catch (e) {
      alert((e as Error).message);
    }
  }, [creatorEdits, loadCreators]);

  const handleDeleteCreator = useCallback(async (creator: DemoCreator) => {
    if (!confirm(MSG.projectsCreatorDeleteConfirm(creator.name))) return;
    try {
      await creatorService.deleteCreator(creator.id);

      const targets = projects.filter((p) => p.creatorId === creator.id);
      for (const project of targets) {
        await updateProject(project.id, { creatorId: undefined });
      }

      await loadCreators();
    } catch (e) {
      alert((e as Error).message);
    }
  }, [projects, updateProject, loadCreators]);

  return (
    <>
      <div className={classes.header}>
        <Text as="h1" size={700} weight="semibold">
          {MSG.projectsCreatorMaster}
        </Text>
      </div>

      <div className={classes.createRow}>
        <Input
          className={classes.input}
          value={newCreatorName}
          placeholder={MSG.projectsCreatorNamePlaceholder}
          onChange={(_, data) => setNewCreatorName(data.value)}
        />
        <Button appearance="primary" onClick={handleCreateCreator}>
          {MSG.projectsCreatorCreate}
        </Button>
      </div>

      {isLoading ? (
        <Spinner label={MSG.loading} />
      ) : (
        <div className={classes.list}>
          {creators.map((creator) => (
            <div key={creator.id} className={classes.row}>
              <Input
                className={classes.input}
                value={creatorEdits[creator.id] ?? creator.name}
                onChange={(_, data) => setCreatorEdits((prev) => ({ ...prev, [creator.id]: data.value }))}
              />
              <Button size="small" appearance="subtle" onClick={() => void handleSaveCreator(creator.id)}>
                {MSG.projectsCreatorSave}
              </Button>
              <Button size="small" appearance="subtle" onClick={() => void handleDeleteCreator(creator)}>
                {MSG.delete}
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
