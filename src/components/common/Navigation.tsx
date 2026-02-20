import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Text,
  Button,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuDivider,
  Badge,
} from '@fluentui/react-components';
import {
  PersonRegular,
  ChevronDownRegular,
  SignOutRegular,
  BuildingSkyscraper24Regular,
} from '@fluentui/react-icons';
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
  },
  link: {
    textDecoration: 'none',
  },
  spacer: {
    flex: 1,
  },
  profileTrigger: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  roleBadge: {
    marginLeft: tokens.spacingHorizontalXS,
  },
});

export default function Navigation() {
  const classes = useStyles();
  const MSG = useMsg();
  const location = useLocation();
  const { logout, selectedCreator, role } = useAuthStore();
  const isViewer = role === 'viewer';

  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname === path;

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

      <Link to="/" className={classes.link}>
        <Button appearance={isActive('/') ? 'primary' : 'subtle'} size="small">
          {MSG.navHome}
        </Button>
      </Link>
      <Link to="/projects" className={classes.link}>
        <Button appearance={isActive('/projects') ? 'primary' : 'subtle'} size="small">
          {MSG.navProjects}
        </Button>
      </Link>
      <Link to="/groups" className={classes.link}>
        <Button appearance={isActive('/groups') ? 'primary' : 'subtle'} size="small">
          {MSG.navGroups}
        </Button>
      </Link>
      <Link to="/feed" className={classes.link}>
        <Button appearance={isActive('/feed') ? 'primary' : 'subtle'} size="small">
          {MSG.navFeed}
        </Button>
      </Link>
      <Link to="/favorites" className={classes.link}>
        <Button appearance={isActive('/favorites') ? 'primary' : 'subtle'} size="small">
          {MSG.navFavorites}
        </Button>
      </Link>

      <div className={classes.spacer} />

      {/* プロフィールドロップダウン */}
      <Menu>
        <MenuTrigger>
          <Button appearance="subtle" size="small" icon={<PersonRegular />} iconPosition="before">
            <span className={classes.profileTrigger}>
              {selectedCreator?.name ?? MSG.navProfile}
              {isViewer && (
                <Badge className={classes.roleBadge} appearance="outline" color="informative" size="small">
                  viewer
                </Badge>
              )}
              <ChevronDownRegular fontSize={12} />
            </span>
          </Button>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuItem icon={<PersonRegular />} onClick={() => navigate('/profile')}>
              {MSG.navProfile}
            </MenuItem>
            {isViewer && (
              <MenuItem icon={<BuildingSkyscraper24Regular />} onClick={() => navigate('/apply-designer')}>
                {MSG.navApplyDesigner}
              </MenuItem>
            )}
            <MenuDivider />
            <MenuItem icon={<SignOutRegular />} onClick={() => void handleLogout()}>
              {MSG.logout}
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
    </nav>
  );
}

