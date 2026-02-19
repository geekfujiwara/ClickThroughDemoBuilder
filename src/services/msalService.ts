/**
 * Microsoft Entra ID (Azure AD) SSO サービス
 * @azure/msal-browser を使用してポップアップ認証を行う
 */
import {
  PublicClientApplication,
  type AuthenticationResult,
  type PopupRequest,
} from '@azure/msal-browser';

/** アプリ登録のクライアントID（公開情報のため直書きOK） */
const ENTRA_CLIENT_ID = '9d6c95c2-7455-498a-a16b-154ca67e6258';

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
