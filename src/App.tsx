import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Spinner } from '@fluentui/react-components';
import AppLayout from '@/components/common/AppLayout';
import AuthGuard from '@/components/auth/AuthGuard';
import { useAuthStore } from '@/stores/authStore';

const HomePage = lazy(() => import('@/pages/HomePage'));
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage'));
const GroupMasterPage = lazy(() => import('@/pages/GroupMasterPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const DesignerPage = lazy(() => import('@/pages/DesignerPage'));
const PlayerPage = lazy(() => import('@/pages/PlayerPage'));
const LoginPage = lazy(() => import('@/components/auth/LoginPage'));
const ViewerDemosPage = lazy(() => import('@/components/viewer/ViewerDemosPage'));
const FeedPage = lazy(() => import('@/pages/FeedPage'));
const FavoritesPage = lazy(() => import('@/pages/FavoritesPage'));
const ApplyDesignerPage = lazy(() => import('@/pages/ApplyDesignerPage'));

function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
      <Spinner size="large" label="Loading..." />
    </div>
  );
}

export default function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* 認証ページ（未認証でもアクセス可） */}
        <Route path="/login" element={<LoginPage />} />

        {/* viewer / designer 共通ページ */}
        <Route element={<AuthGuard role="viewer" />}>
          {/* viewer 専用（旧互換） */}
          <Route path="/viewer/demos" element={<ViewerDemosPage />} />
          <Route path="/player/:projectId" element={<PlayerPage />} />

          {/* メインアプリ（viewer & designer） */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/groups" element={<GroupMasterPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/apply-designer" element={<ApplyDesignerPage />} />
          </Route>
        </Route>

        {/* Designer 専用ページ（designer ロール必要） */}
        <Route element={<AuthGuard role="designer" />}>
          <Route path="/designer" element={<DesignerPage />} />
          <Route path="/designer/:projectId" element={<DesignerPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
