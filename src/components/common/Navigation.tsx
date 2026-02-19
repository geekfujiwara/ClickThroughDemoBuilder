import { Link, useLocation } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Badge,
} from '@fluentui/react-components';
import { useAuthStore } from '@/stores/authStore';
import AppSymbol from './AppSymbol';
import { useMsg } from '@/hooks/useMsg';

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
  userBadge: {
    fontSize: tokens.fontSizeBase200,
    marginLeft: tokens.spacingHorizontalXS,
    cursor: 'pointer',
  },
  logout: {
    position: 'absolute',
    top: '8px',
    right: tokens.spacingHorizontalXXL,
  },
});

export default function Navigation() {
  const classes = useStyles();
  const MSG = useMsg();
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const selectedCreator = useAuthStore((s) => s.selectedCreator);
  const clearSelectedCreator = useAuthStore((s) => s.clearSelectedCreator);

  const isProjectsPage = location.pathname === '/projects';
  const isGroupsPage = location.pathname === '/groups';
  const isProfilePage = location.pathname === '/profile';

  const handleLogout = async () => {
    await logout();
    window.location.assign('/');
  };

  const handleSwitchUser = () => {
    clearSelectedCreator();
    window.location.assign('/creator/select');
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
        <Button appearance={isProjectsPage ? 'primary' : 'subtle'} size="small">
          {MSG.navProjects}
        </Button>
      </Link>
      <Link to="/groups" className={classes.link}>
        <Button appearance={isGroupsPage ? 'primary' : 'subtle'} size="small">
          {MSG.navGroups}
        </Button>
      </Link>
      <Link to="/profile" className={classes.link}>
        <Button appearance={isProfilePage ? 'primary' : 'subtle'} size="small">
          {MSG.navProfile}
        </Button>
      </Link>
      {selectedCreator && (
        <Badge
          className={classes.userBadge}
          appearance="outline"
          color="brand"
          onClick={handleSwitchUser}
        >
          {selectedCreator.name}
        </Badge>
      )}
      <Button className={classes.logout} appearance="subtle" size="small" onClick={() => void handleLogout()}>
        {MSG.logout}
      </Button>
    </nav>
  );
}
