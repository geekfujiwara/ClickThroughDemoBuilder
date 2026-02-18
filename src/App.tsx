import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Spinner } from '@fluentui/react-components';
import AppLayout from '@/components/common/AppLayout';
import AuthGuard from '@/components/auth/AuthGuard';
import { useAuthStore } from '@/stores/authStore';

const HomePage = lazy(() => import('@/pages/HomePage'));
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage'));
const GroupMasterPage = lazy(() => import('@/pages/GroupMasterPage'));
const CreatorMasterPage = lazy(() => import('@/pages/CreatorMasterPage'));
const DesignerPage = lazy(() => import('@/pages/DesignerPage'));
const PlayerPage = lazy(() => import('@/pages/PlayerPage'));
const ViewerLoginPage = lazy(() => import('@/components/auth/ViewerLoginPage'));
const AdminLoginPage = lazy(() => import('@/components/auth/AdminLoginPage'));
const ViewerDemosPage = lazy(() => import('@/components/viewer/ViewerDemosPage'));

function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
      <Spinner size="large" label="読み込み中..." />
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
        <Route path="/viewer/login" element={<ViewerLoginPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />

        {/* Viewer 用ページ（viewer / designer ロール必要） */}
        <Route element={<AuthGuard role="viewer" />}>
          <Route path="/viewer/demos" element={<ViewerDemosPage />} />
          <Route path="/player/:projectId" element={<PlayerPage />} />
        </Route>

        {/* Designer 用ページ（designer ロール必要） */}
        <Route element={<AuthGuard role="designer" />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/groups" element={<GroupMasterPage />} />
            <Route path="/creators" element={<CreatorMasterPage />} />
          </Route>
          <Route path="/designer" element={<DesignerPage />} />
          <Route path="/designer/:projectId" element={<DesignerPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
