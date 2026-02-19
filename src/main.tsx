import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import App from './App';
import { initTelemetry } from './services/telemetry';
import './styles/global.css';
import './styles/animations.css';

const APP_BASE_PATH = '/';

function normalizeBasePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === '/') return '/';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

const BASENAME = normalizeBasePath(APP_BASE_PATH);

function isMsalCallbackPopup(): boolean {
  if (!window.opener) return false;
  const hash = window.location.hash;
  const search = window.location.search;
  const hasAuthParams =
    /(^|[&#?])(code|id_token|access_token|state)=/.test(hash) ||
    /(^|[&#?])(code|id_token|access_token|state)=/.test(search);
  return hasAuthParams;
}

// Application Insights 初期化 (接続文字列がある場合のみ)
void initTelemetry();

if (isMsalCallbackPopup()) {
  const root = document.getElementById('root');
  if (root) {
    root.textContent = 'Completing sign-in...';
  }
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter basename={BASENAME === '/' ? undefined : BASENAME}>
        <FluentProvider theme={webLightTheme}>
          <App />
        </FluentProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
}
