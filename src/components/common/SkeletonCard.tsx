import { makeStyles, tokens } from '@fluentui/react-components';

const useStyles = makeStyles({
  card: {
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground3,
    height: '220px',
    animation: 'skeletonPulse 1.5s ease-in-out infinite',
  },
});

export default function SkeletonCard() {
  const classes = useStyles();
  return <div className={classes.card} />;
}
