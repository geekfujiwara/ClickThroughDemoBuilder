/**
 * Microsoft Entra ID (Azure AD) SSO サービス
 * @azure/msal-browser を使用してポップアップ認証を行う
 */
import {
  PublicClientApplication,
  type AuthenticationResult,
  type PopupRequest,
} from '@azure/msal-browser';

/**
 * アプリ登録のクライアントID
 * SPA の OAuth フローではクライアントIDはブラウザに必ず公開される公開情報。
 * ビルド時に VITE_ENTRA_CLIENT_ID 環境変数（GitHub Secret）から注入する。
 */
const ENTRA_CLIENT_ID = import.meta.env.VITE_ENTRA_CLIENT_ID as string | undefined;
if (!ENTRA_CLIENT_ID) {
  throw new Error('VITE_ENTRA_CLIENT_ID is not set. Add it to your .env.local or GitHub Secrets.');
}

const msalInstance = new PublicClientApplication({
  auth: {
    clientId: ENTRA_CLIENT_ID,
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
});

let initialized = false;

async function ensureInitialized(): Promise<void> {
  if (!initialized) {
    await msalInstance.initialize();
    initialized = true;
  }
}

const loginRequest: PopupRequest = {
  scopes: ['openid', 'profile', 'email'],
};

/**
 * Microsoft アカウントでポップアップサインイン
 * @returns ID トークン文字列
 */
export async function signInWithMicrosoft(): Promise<AuthenticationResult> {
  await ensureInitialized();
  return msalInstance.loginPopup(loginRequest);
}

/**
 * Microsoft アカウントからサインアウト（MSAL キャッシュをクリア）
 */
export async function signOutFromMicrosoft(): Promise<void> {
  await ensureInitialized();
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    await msalInstance.logoutPopup({ account: accounts[0] });
  }
}
