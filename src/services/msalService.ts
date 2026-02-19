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

let msalInstance: PublicClientApplication | null = null;
let initialized = false;

async function ensureInitialized(): Promise<PublicClientApplication> {
  if (!ENTRA_CLIENT_ID) {
    throw new Error('VITE_ENTRA_CLIENT_ID is not configured. Set it in .env.local or GitHub Secrets.');
  }
  if (!msalInstance) {
    msalInstance = new PublicClientApplication({
      auth: {
        clientId: ENTRA_CLIENT_ID,
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: 'sessionStorage',
      },
    });
  }
  if (!initialized) {
    await msalInstance.initialize();
    initialized = true;
  }
  return msalInstance;
}

const loginRequest: PopupRequest = {
  scopes: ['openid', 'profile', 'email'],
};

/**
 * Microsoft アカウントでポップアップサインイン
 * @returns ID トークン文字列
 */
export async function signInWithMicrosoft(): Promise<AuthenticationResult> {
  const client = await ensureInitialized();
  return client.loginPopup(loginRequest);
}

/**
 * Microsoft アカウントからサインアウト（MSAL キャッシュをクリア）
 */
export async function signOutFromMicrosoft(): Promise<void> {
  const client = await ensureInitialized();
  const accounts = client.getAllAccounts();
  if (accounts.length > 0) {
    await client.logoutPopup({ account: accounts[0] });
  }
}
