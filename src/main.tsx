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
  const hash = window.location.hash;
  const search = window.location.search;
  const combined = hash + search;

  // Check for OAuth authorization code response (code + state)
  const hasCodeResponse =
    (/(^|[&#?])code=/.test(combined) && /(^|[&#?])state=/.test(combined));

  // Check for implicit flow response (id_token or access_token)
  const hasTokenResponse =
    /(^|[&#?])(id_token|access_token)=/.test(combined);

  // Check for error response from auth server
  const hasErrorResponse =
    /(^|[&#?])error=/.test(combined) && /(^|[&#?])state=/.test(combined);

  // If auth callback params are present, don't mount the React app.
  // Let MSAL's handleRedirectPromise() process the response and close the popup.
  if (hasCodeResponse || hasTokenResponse || hasErrorResponse) return true;

  // Fallback: if window.opener exists, we might be in a popup even without
  // visible auth params (e.g. already consumed by MSAL initialize)
  if (window.opener && /(^|[&#?])state=/.test(combined)) return true;

  return false;
}

// Application Insights 初期化 (接続文字列がある場合のみ)
void initTelemetry();

if (isMsalCallbackPopup()) {
  // This is the popup callback window. Do NOT initialize MSAL or modify
  // the URL in any way. The main window's loginPopup() is polling
  // popup.location.hash — it will read the auth code, exchange it for
  // tokens, and close this popup automatically.
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
