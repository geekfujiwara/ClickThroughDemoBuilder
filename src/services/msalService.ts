/**
 * Microsoft Entra ID (Azure AD) SSO サービス
 * @azure/msal-browser を使用してポップアップ認証を行う
 *
 * 重要: MSAL v5 のポップアップフローでは、ポップアップ内に読み込まれた SPA でも
 * initialize() を呼ぶ必要があります。モジュールロード時に即時初期化することで、
 * ポップアップがコールバック URL に遷移した際に自動的にレスポンスを処理して閉じます。
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

// MSAL インスタンスと初期化 Promise を即座に作成する
// ポップアップウィンドウ内でも initialize() が呼ばれることで、
// MSAL がポップアップ応答を自動処理してウィンドウを閉じられる
let msalInstance: PublicClientApplication | null = null;
let initPromise: Promise<PublicClientApplication> | null = null;

function getInitPromise(): Promise<PublicClientApplication> {
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

  initPromise = instance.initialize().then(() => {
    // メインウィンドウ（popup でない）起動時にのみ、前回中断されたインタラクションの
    // 残留ロックを削除する。popup 内では window.opener が設定されているため対象外。
    if (!window.opener) {
      for (const key of Object.keys(sessionStorage)) {
        if (key.endsWith('.interaction.status')) {
          sessionStorage.removeItem(key);
        }
      }
    }
    msalInstance = instance;
    return instance;
  });

  return initPromise;
}

// モジュールロード時に即時初期化を開始する（ポップアップ内での自動クローズに必要）
if (ENTRA_CLIENT_ID && typeof window !== 'undefined') {
  void getInitPromise();
}

/**
 * Microsoft アカウントでポップアップサインイン
 * @returns 認証結果（idToken を含む）
 */
export async function signInWithMicrosoft(): Promise<AuthenticationResult> {
  const client = await getInitPromise();
  return client.loginPopup(loginRequest);
}

/**
 * Microsoft アカウントからサインアウト（MSAL キャッシュをクリア）
 */
export async function signOutFromMicrosoft(): Promise<void> {
  if (!msalInstance) return;
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    await msalInstance.logoutPopup({ account: accounts[0] });
  }
  msalInstance.clearCache();
}