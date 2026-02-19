/**
 * Microsoft Entra ID (Azure AD) SSO サービス
 * @azure/msal-browser を使用してポップアップ認証を行う
 */
import {
  PublicClientApplication,
  type AuthenticationResult,
  type PopupRequest,
} from '@azure/msal-browser';

const ENTRA_CLIENT_ID = import.meta.env.VITE_ENTRA_CLIENT_ID as string | undefined;

const loginRequest: PopupRequest = {
  scopes: ['openid', 'profile', 'email'],
};
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
        redirectUri: `${window.location.origin}/auth-popup.html`,
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

/**
 * Microsoft アカウントでポップアップサインイン
 * @returns 認証結果（idToken を含む）
 */
export async function signInWithMicrosoft(): Promise<AuthenticationResult> {
  const client = await ensureInitialized();
  return client.loginPopup(loginRequest);
}

/**
 * Microsoft アカウントからサインアウト（MSAL キャッシュをクリア）
 */
export async function signOutFromMicrosoft(): Promise<void> {
  await ensureInitialized();
  if (!msalInstance) return;
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    await msalInstance.logoutPopup({ account: accounts[0] });
  }
  msalInstance.clearCache();
}