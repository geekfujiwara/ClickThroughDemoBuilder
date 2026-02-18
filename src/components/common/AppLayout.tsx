import { type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import { makeStyles, tokens } from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  },
  main: {
    flex: 1,
    maxWidth: '1440px',
    width: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
    paddingTop: tokens.spacingVerticalXXL,
    paddingBottom: tokens.spacingVerticalXXL,
  },
});

interface AppLayoutProps {
  children?: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const classes = useStyles();
  return (
    <div className={classes.root}>
      <Navigation />
      <main className={classes.main}>{children ?? <Outlet />}</main>
    </div>
  );
}
