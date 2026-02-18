import { Link, useLocation } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Button,
} from '@fluentui/react-components';
import { MSG } from '@/constants/messages';
import { useAuthStore } from '@/stores/authStore';
import AppSymbol from './AppSymbol';

const useStyles = makeStyles({
  nav: {
    display: 'flex',
    position: 'relative',
    alignItems: 'center',
    height: '48px',
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    gap: tokens.spacingHorizontalM,
  },
  logo: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorBrandForeground1,
    marginRight: 'auto',
  },
  link: {
    textDecoration: 'none',
  },
  logout: {
    position: 'absolute',
    top: '8px',
    right: tokens.spacingHorizontalXXL,
  },
});

export default function Navigation() {
  const classes = useStyles();
  const location = useLocation();
  const isProjectsPage = location.pathname === '/projects';
  const isGroupsPage = location.pathname === '/groups';
  const isCreatorsPage = location.pathname === '/creators';
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    window.location.assign('/');
  };

  return (
    <nav className={classes.nav}>
      <Link to="/" className={classes.link}>
        <Text className={classes.logo}>
          <AppSymbol size={22} />
          {MSG.appName}
        </Text>
      </Link>
      <Link to="/projects" className={classes.link}>
        <Button
          appearance={isProjectsPage ? 'primary' : 'subtle'}
          size="small"
        >
          {MSG.navProjects}
        </Button>
      </Link>
      <Link to="/groups" className={classes.link}>
        <Button
          appearance={isGroupsPage ? 'primary' : 'subtle'}
          size="small"
        >
          {MSG.navGroups}
        </Button>
      </Link>
      <Link to="/creators" className={classes.link}>
        <Button
          appearance={isCreatorsPage ? 'primary' : 'subtle'}
          size="small"
        >
          {MSG.navCreators}
        </Button>
      </Link>
      <Button className={classes.logout} appearance="subtle" size="small" onClick={() => void handleLogout()}>
        ログアウト
      </Button>
    </nav>
  );
}
