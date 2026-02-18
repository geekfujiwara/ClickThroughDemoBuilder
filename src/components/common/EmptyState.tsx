import { makeStyles, tokens, Text, Button } from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: '80px',
    paddingBottom: '80px',
    gap: tokens.spacingVerticalL,
  },
  icon: {
    fontSize: '48px',
    opacity: 0.4,
  },
  title: {
    color: tokens.colorNeutralForeground3,
  },
  description: {
    color: tokens.colorNeutralForeground4,
  },
});

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon = '📂',
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const classes = useStyles();
  return (
    <div className={classes.root}>
      <span className={classes.icon}>{icon}</span>
      <Text size={500} weight="semibold" className={classes.title}>
        {title}
      </Text>
      {description && (
        <Text size={300} className={classes.description}>
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button appearance="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
