import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Spinner } from '@fluentui/react-components';
import AppLayout from '@/components/common/AppLayout';
import AuthGuard from '@/components/auth/AuthGuard';
import CreatorSelectionGuard from '@/components/auth/CreatorSelectionGuard';
import { useAuthStore } from '@/stores/authStore';

const HomePage = lazy(() => import('@/pages/HomePage'));
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage'));
const UserMasterPage = lazy(() => import('@/pages/UserMasterPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const DesignerPage = lazy(() => import('@/pages/DesignerPage'));
const PlayerPage = lazy(() => import('@/pages/PlayerPage'));
const LoginPage = lazy(() => import('@/components/auth/LoginPage'));
const ViewerLoginPage = lazy(() => import('@/components/auth/ViewerLoginPage'));
const AdminLoginPage = lazy(() => import('@/components/auth/AdminLoginPage'));
const RegisterPage = lazy(() => import('@/components/auth/RegisterPage'));
const VerifyEmailPage = lazy(() => import('@/components/auth/VerifyEmailPage'));
const ViewerDemosPage = lazy(() => import('@/components/viewer/ViewerDemosPage'));
const CreatorSelectionPage = lazy(() => import('@/components/auth/CreatorSelectionPage'));

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
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify" element={<VerifyEmailPage />} />
        <Route path="/viewer/login" element={<ViewerLoginPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />

        {/* 作成者選択ページ（認証済みならアクセス可） */}
        <Route element={<CreatorSelectionGuard />}>
          <Route path="/creator/select" element={<CreatorSelectionPage />} />
        </Route>

        {/* Viewer 用ページ（viewer / designer ロール必要 + 作成者選択済み） */}
        <Route element={<AuthGuard role="viewer" />}>
          <Route path="/viewer/demos" element={<ViewerDemosPage />} />
          <Route path="/player/:projectId" element={<PlayerPage />} />
        </Route>

        {/* Designer 用ページ（designer ロール必要 + 作成者選択済み） */}
        <Route element={<AuthGuard role="designer" />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/users" element={<UserMasterPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="/designer" element={<DesignerPage />} />
          <Route path="/designer/:projectId" element={<DesignerPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
