import { Link, useLocation } from 'react-router-dom';
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
  ShieldKeyholeRegular,
  LocalLanguageRegular,
} from '@fluentui/react-icons';
import { useAuthStore } from '@/stores/authStore';
import AppSymbol from './AppSymbol';
import { useMsg } from '@/hooks/useMsg';
import { setCurrentLanguage } from '@/constants/i18n';
import { useGuestPath, useGuestNavigate } from '@/hooks/useGuestNav';

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
  githubLink: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground3,
    textDecoration: 'none',
    fontSize: tokens.fontSizeBase200,
    padding: `0 ${tokens.spacingHorizontalS}`,
    ':hover': {
      color: tokens.colorNeutralForeground1,
    },
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
  const { logout, selectedCreator, role, isGuest } = useAuthStore();
  const isViewer = role === 'viewer';
  const isAdmin = role === 'system_admin' || role === 'user_admin';

  const navigate = useGuestNavigate();
  const linkTo = useGuestPath();
  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    if (isGuest) {
      window.location.assign('/login?guestMode=true');
    } else {
      window.location.assign('/');
    }
  };

  return (
    <nav className={classes.nav}>
      <Link to={linkTo('/')} className={classes.link}>
        <Text className={classes.logo}>
          <AppSymbol size={22} />
          {MSG.appName}
        </Text>
      </Link>

      <Link to={linkTo('/')} className={classes.link}>
        <Button appearance={isActive('/') ? 'primary' : 'subtle'} size="small">
          {MSG.navHome}
        </Button>
      </Link>
      <Link to={linkTo('/projects')} className={classes.link}>
        <Button appearance={isActive('/projects') ? 'primary' : 'subtle'} size="small">
          {MSG.navProjects}
        </Button>
      </Link>
      <Link to={linkTo('/groups')} className={classes.link}>
        <Button appearance={isActive('/groups') ? 'primary' : 'subtle'} size="small">
          {MSG.navGroups}
        </Button>
      </Link>
      <Link to={linkTo('/feed')} className={classes.link}>
        <Button appearance={isActive('/feed') ? 'primary' : 'subtle'} size="small">
          {MSG.navFeed}
        </Button>
      </Link>
      {!isGuest && (
        <Link to={linkTo('/favorites')} className={classes.link}>
          <Button appearance={isActive('/favorites') ? 'primary' : 'subtle'} size="small">
            {MSG.navFavorites}
          </Button>
        </Link>
      )}
      {isAdmin && (
        <Link to="/admin/users" className={classes.link}>
          <Button
            appearance={isActive('/admin/users') ? 'primary' : 'subtle'}
            size="small"
            icon={<ShieldKeyholeRegular />}
          >
            {MSG.navUserManagement}
          </Button>
        </Link>
      )}

      <div className={classes.spacer} />

      {/* GitHub リポジトリリンク */}
      <a
        href="https://github.com/geekfujiwara/ClickThroughDemoBuilder"
        target="_blank"
        rel="noopener noreferrer"
        className={classes.githubLink}
        aria-label="GitHub Repository"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
        </svg>
      </a>

      {/* プロフィールドロップダウン */}
      <Menu>
        <MenuTrigger>
          <Button appearance="subtle" size="small" icon={<PersonRegular />} iconPosition="before">
            <span className={classes.profileTrigger}>
              {isGuest ? 'ゲスト' : (selectedCreator?.name ?? MSG.navProfile)}
              {isViewer && (
                <Badge className={classes.roleBadge} appearance="outline" color="informative" size="small">
                  viewer
                </Badge>
              )}
              {role === 'user_admin' && (
                <Badge className={classes.roleBadge} appearance="outline" color="warning" size="small">
                  admin
                </Badge>
              )}
              {role === 'system_admin' && (
                <Badge className={classes.roleBadge} appearance="outline" color="danger" size="small">
                  sysadmin
                </Badge>
              )}
              <ChevronDownRegular fontSize={12} />
            </span>
          </Button>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            {!isGuest && (
              <MenuItem icon={<PersonRegular />} onClick={() => navigate('/profile')}>
                {MSG.navProfile}
              </MenuItem>
            )}
            {isViewer && !isGuest && (
              <MenuItem icon={<BuildingSkyscraper24Regular />} onClick={() => navigate('/apply-designer')}>
                {MSG.navApplyDesigner}
              </MenuItem>
            )}
            <MenuItem icon={<LocalLanguageRegular />} onClick={() => setCurrentLanguage('ja')}>
              日本語
            </MenuItem>
            <MenuItem icon={<LocalLanguageRegular />} onClick={() => setCurrentLanguage('en')}>
              English
            </MenuItem>
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

