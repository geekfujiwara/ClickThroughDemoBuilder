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
let initPromise: Promise<PublicClientApplication> | null = null;

function isInteractionInProgressError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { errorCode?: string; message?: string };
  return err.errorCode === 'interaction_in_progress' || err.message?.includes('interaction_in_progress') === true;
}

function clearInteractionLock(): void {
  for (const storage of [sessionStorage, localStorage]) {
    const keys = Object.keys(storage);
    for (const key of keys) {
      if (key.includes('interaction.status')) {
        storage.removeItem(key);
      }
    }
  }
}

function ensureInitialized(): Promise<PublicClientApplication> {
  if (initPromise) return initPromise;

  if (!ENTRA_CLIENT_ID) {
    return Promise.reject(
      new Error('VITE_ENTRA_CLIENT_ID is not configured. Set it in .env.local or GitHub Secrets.'),
    );
  }

  const instance = new PublicClientApplication({
    auth: {
      clientId: ENTRA_CLIENT_ID,
      authority: 'https://login.microsoftonline.com/common',
      redirectUri: window.location.origin,
    },
    cache: {
      cacheLocation: 'sessionStorage',
    },
  });

  initPromise = instance.initialize().then(async () => {
    // handleRedirectPromise MUST be called on every page load, including popups.
    // In popup windows, this detects the auth response hash, communicates
    // it back to the main window, and closes the popup automatically.
    try {
      await instance.handleRedirectPromise();
    } catch (e) {
      // In popup windows, handleRedirectPromise may throw after closing.
      // In the main window, errors here are non-fatal for popup flow.
      console.warn('handleRedirectPromise error (non-fatal):', e);
    }
    msalInstance = instance;
    return instance;
  });

  return initPromise;
}

if (ENTRA_CLIENT_ID && typeof window !== 'undefined') {
  void ensureInitialized();
}

/**
 * Microsoft アカウントでポップアップサインイン
 * @returns 認証結果（idToken を含む）
 */
export async function signInWithMicrosoft(): Promise<AuthenticationResult> {
  const client = await ensureInitialized();
  try {
    return await client.loginPopup(loginRequest);
  } catch (error) {
    if (!isInteractionInProgressError(error)) {
      throw error;
    }
    clearInteractionLock();
    return client.loginPopup(loginRequest);
  }
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