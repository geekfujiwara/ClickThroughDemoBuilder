import { useEffect, useCallback } from 'react';
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
} from '@fluentui/react-components';
import { PlayRegular, EditRegular } from '@fluentui/react-icons';
import EmptyState from '@/components/common/EmptyState';
import SkeletonCard from '@/components/common/SkeletonCard';
import { useProjectStore } from '@/stores/projectStore';
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

export default function HomePage() {
  const classes = useStyles();
  const navigate = useNavigate();
  const { projects, isLoading, loadProjects } = useProjectStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const recentProjects = projects.slice(0, 6);

  const handleNewProject = useCallback(() => {
    navigate('/designer');
  }, [navigate]);

  /** 説明文を最大長で切り詰める */
  const truncate = (text: string, max = 80) =>
    text.length > max ? text.slice(0, max) + '…' : text;

  return (
    <>
      {/* ヒーローセクション */}
      <section className={classes.hero}>
        <Text as="h1" size={800} weight="semibold" className={classes.heroTitle}>
          {MSG.homeHeroTitle}
        </Text>
        <div className={classes.heroActions}>
          <Button appearance="primary" size="large" onClick={handleNewProject}>
            {MSG.homeNewProject}
          </Button>
          <Button
            appearance="secondary"
            size="large"
            onClick={() => navigate('/projects')}
          >
            {MSG.homeViewProjects}
          </Button>
        </div>
      </section>

      {/* 最近のプロジェクト */}
      <section className={classes.section}>
        <Text as="h2" size={600} weight="semibold" className={classes.sectionTitle}>
          {MSG.homeRecentProjects}
        </Text>

        {isLoading ? (
          <div className={classes.grid}>
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : recentProjects.length === 0 ? (
          <EmptyState
            title={MSG.homeEmptyTitle}
            description={MSG.homeEmptyDescription}
            actionLabel={MSG.homeNewProject}
            onAction={handleNewProject}
          />
        ) : (
          <div className={classes.grid}>
            {recentProjects.map((project) => (
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
                    </>
                  }
                />
                <CardFooter className={classes.cardActions}>
                  <Button
                    icon={<PlayRegular />}
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/player/${project.id}`);
                    }}
                  >
                    再生
                  </Button>
                  <Button
                    icon={<EditRegular />}
                    size="small"
                    appearance="subtle"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/designer/${project.id}`);
                    }}
                  >
                    編集
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
