# MSAL v5 ポップアップ SSO 実装ガイド

> **対象**: `@azure/msal-browser` v5.x + React SPA + Azure Static Web Apps  
> **認証フロー**: ポップアップ（Popup）方式  
> **このドキュメントの目的**: 正しい設計パターンと、試行錯誤で判明した「やってはいけないこと」をまとめ、次回以降の実装を短時間で完了できるようにする。
>
> **v2 追記**: Azure Blob Storage アクセス権限設定（共有キー認証無効環境での `ClientSecretCredential` 利用・RBAC ロール・パブリックネットワーク設定）を追加。

---

## 目次

1. [アーキテクチャ概要](#1-アーキテクチャ概要)
2. [MSAL v5 ポップアップフローの仕組み](#2-msal-v5-ポップアップフローの仕組み)
3. [正しい実装（4 ファイル）](#3-正しい実装4-ファイル)
4. [Azure 側の設定](#4-azure-側の設定)
5. [やってはいけないこと（失敗パターン集）](#5-やってはいけないこと失敗パターン集)
6. [トラブルシューティング](#6-トラブルシューティング)
7. [チェックリスト](#7-チェックリスト)

---

## 1. アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────┐
│  Azure Static Web Apps                                      │
│                                                             │
│  ┌─────────────────────┐    ┌────────────────────────────┐  │
│  │  Frontend (React)   │    │  API (Azure Functions v4)  │  │
│  │  /index.html        │    │  /api/auth/entra           │  │
│  │  msalService.ts     │───▶│  idToken 検証 → JWT 発行   │  │
│  │  main.tsx           │    │  /api/auth/me              │  │
│  │  authStore.ts       │    │  セッション確認             │  │
│  └─────────────────────┘    └────────────────────────────┘  │
│           │                                                  │
│           │ loginPopup()                                    │
│           ▼                                                  │
│  ┌─────────────────────┐                                    │
│  │  Popup Window       │                                    │
│  │  → login.microsoft  │                                    │
│  │  → redirectUri      │                                    │
│  │  → broadcastResponse│                                    │
│  │  → window.close()   │                                    │
│  └─────────────────────┘                                    │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Microsoft Entra ID         │
│  (Azure AD)                 │
│  /authorize → /token        │
│  JWKS 公開鍵                │
└─────────────────────────────┘
```

### 認証の全体フロー

1. ユーザーが「Microsoft でサインイン」ボタンをクリック
2. フロントエンドが `loginPopup()` を呼び、ポップアップウィンドウが開く
3. ポップアップが Microsoft のログイン画面を表示
4. ユーザーが認証完了 → Azure AD が `redirectUri` にリダイレクト
5. **ポップアップ内で `broadcastResponseToMainFrame()` が実行される**（★核心）
6. `BroadcastChannel` でメインウィンドウに認証コードが送信される
7. ポップアップが自動で閉じる
8. メインウィンドウの `loginPopup()` が resolve し、`idToken` を取得
9. フロントエンドが `POST /api/auth/entra` に `idToken` を送信
10. バックエンドが `idToken` を検証し、セッション用 JWT を発行

---

## 2. MSAL v5 ポップアップフローの仕組み

### ⚠️ v4 と v5 の決定的な違い

| 項目 | MSAL v4 以前 | MSAL v5 |
|------|------------|---------|
| ポップアップ監視方式 | `setInterval` で `popup.location.hash` をポーリング | **`BroadcastChannel` API** によるメッセージング |
| ポップアップ側の処理 | 不要（メインウィンドウが自力でハッシュを読む） | **`broadcastResponseToMainFrame()` の呼び出しが必須** |
| ポップアップを閉じる主体 | メインウィンドウがハッシュ読み取り後に閉じる | `broadcastResponseToMainFrame()` 内で `window.close()` |
| `handleRedirectPromise()` | ポップアップ内で呼ぶことで代替可能だった | **ポップアップ内で呼んではいけない**（ハッシュを消費してしまう） |

### v5 の内部動作（詳細）

```
メインウィンドウ                              ポップアップウィンドウ
─────────────                                ──────────────────

1. loginPopup() 呼出
2. window.open() でポップアップ起動
3. Azure AD /authorize にナビゲート
4. BroadcastChannel(stateId) で
   リッスン開始
   └─ waitForBridgeResponse()
                                             5. ユーザーがログイン
                                             6. Azure AD → redirectUri にリダイレクト
                                                (URL ハッシュに code=...&state=... が付く)
                                             7. SPA が読み込まれる（index.html）
                                             8. main.tsx でポップアップコールバックを検出
                                             9. broadcastResponseToMainFrame() を呼ぶ
                                                ├─ URL ハッシュから code, state を抽出
                                                ├─ state 内の libraryState.id を取得
                                                ├─ BroadcastChannel(id).postMessage()
                                                └─ window.close()
10. channel.onmessage で受信
11. 認証コード → トークン交換
12. loginPopup() Promise が resolve
    → AuthenticationResult を返却
```

**重要**: `state` パラメータ内に MSAL が埋め込んだ一意の ID（UUID）が、`BroadcastChannel` のチャンネル名として使われる。これによりメインウィンドウとポップアップが正しく通信できる。

---

## 3. 正しい実装（4 ファイル）

### 3-1. `src/services/msalService.ts` — MSAL サービス

```typescript
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

// ★ ポップアップコールバックウィンドウかどうか判定
function isPopupCallbackWindow(): boolean {
  const hash = window.location.hash;
  return /(^|[&#?])code=/.test(hash) && /(^|[&#?])state=/.test(hash);
}

function ensureInitialized(): Promise<PublicClientApplication> {
  if (initPromise) return initPromise;

  if (!ENTRA_CLIENT_ID) {
    return Promise.reject(new Error('VITE_ENTRA_CLIENT_ID is not configured.'));
  }

  const instance = new PublicClientApplication({
    auth: {
      clientId: ENTRA_CLIENT_ID,
      authority: 'https://login.microsoftonline.com/common',
      redirectUri: window.location.origin,  // ★ origin のみ（パスなし）
    },
    cache: {
      cacheLocation: 'sessionStorage',
    },
  });

  // ★ initialize() のみ。handleRedirectPromise() は呼ばない。
  initPromise = instance.initialize().then(() => {
    msalInstance = instance;
    return instance;
  });

  return initPromise;
}

// ★ メインウィンドウでのみ eager init。ポップアップでは初期化しない。
if (ENTRA_CLIENT_ID && typeof window !== 'undefined' && !isPopupCallbackWindow()) {
  void ensureInitialized();
}

export async function signInWithMicrosoft(): Promise<AuthenticationResult> {
  const client = await ensureInitialized();
  return client.loginPopup(loginRequest);
}
```

#### ポイント

| ルール | 理由 |
|--------|------|
| `redirectUri` は `window.location.origin`（パスなし） | Entra アプリ登録の Redirect URI と完全一致させる |
| ポップアップウィンドウでは MSAL を初期化しない | 初期化すると URL ハッシュが消費されてしまう |
| `handleRedirectPromise()` は呼ばない | ポップアップフローでは不要。呼ぶとハッシュが消費される |
| `cacheLocation: 'sessionStorage'` | ポップアップとメインウィンドウ間でキャッシュが共有されない方が安全 |

---

### 3-2. `src/main.tsx` — エントリーポイント（★最重要）

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ★ ポップアップコールバックかどうか判定する関数
function isMsalCallbackPopup(): boolean {
  const hash = window.location.hash;
  const search = window.location.search;
  const combined = hash + search;

  // OAuth 認証コードレスポンス (code + state)
  const hasCodeResponse =
    /(^|[&#?])code=/.test(combined) && /(^|[&#?])state=/.test(combined);

  // 暗黙フローレスポンス (id_token or access_token)
  const hasTokenResponse =
    /(^|[&#?])(id_token|access_token)=/.test(combined);

  // エラーレスポンス
  const hasErrorResponse =
    /(^|[&#?])error=/.test(combined) && /(^|[&#?])state=/.test(combined);

  if (hasCodeResponse || hasTokenResponse || hasErrorResponse) return true;

  // フォールバック: window.opener + state がある場合もポップアップと判断
  if (window.opener && /(^|[&#?])state=/.test(combined)) return true;

  return false;
}

if (isMsalCallbackPopup()) {
  // ──────────────────────────────────────────────────────
  // ★ ポップアップウィンドウ: React アプリをマウントしない
  // ──────────────────────────────────────────────────────
  const root = document.getElementById('root');
  if (root) {
    root.textContent = 'Completing sign-in...';
  }

  // ★★★ MSAL v5 の redirect-bridge を使って認証レスポンスをメインウィンドウに送信
  import('@azure/msal-browser/redirect-bridge')
    .then(({ broadcastResponseToMainFrame }) => {
      return broadcastResponseToMainFrame();
      // ↑ これが内部で:
      //   1. URL ハッシュから code, state を抽出
      //   2. state 内の ID で BroadcastChannel を作成
      //   3. postMessage() でメインウィンドウに送信
      //   4. window.close() でポップアップを閉じる
    })
    .catch(() => {
      window.close();  // フォールバック
    });

} else {
  // ──────────────────────────────────────────────
  // メインウィンドウ: 通常通り React アプリをマウント
  // ──────────────────────────────────────────────
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
```

#### なぜ `main.tsx` で分岐するのか

ポップアップウィンドウが `redirectUri`（= サイトのオリジン）に戻ると、React SPA の `index.html` が読み込まれる。ここで React アプリを通常通りマウントすると：

1. React Router が URL を解釈しようとする
2. AuthGuard が認証状態をチェックし `/login` にリダイレクトする
3. URL ハッシュ（`#code=...&state=...`）が失われる
4. メインウィンドウが認証レスポンスを受け取れない

→ **ポップアップでは React をマウントせず、`broadcastResponseToMainFrame()` だけ実行する**

---

### 3-3. `api/src/functions/auth-entra.ts` — バックエンド（トークン検証）

```typescript
import { app, type HttpRequest, type HttpResponseInit } from '@azure/functions';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const ENTRA_CLIENT_ID = process.env.ENTRA_CLIENT_ID ?? '<your-client-id>';

async function handler(req: HttpRequest): Promise<HttpResponseInit> {
  const body = (await req.json()) as { idToken?: string };
  const idToken = body.idToken?.trim();
  if (!idToken) {
    return { status: 400, jsonBody: { error: 'idToken is required.' } };
  }

  // JWT ペイロードから tid を取得
  const parts = idToken.split('.');
  const rawPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  const tid = rawPayload.tid;

  // テナント固有の JWKS で署名検証
  const JWKS = createRemoteJWKSet(
    new URL(`https://login.microsoftonline.com/${tid}/discovery/v2.0/keys`)
  );
  const { payload } = await jwtVerify(idToken, JWKS, {
    audience: ENTRA_CLIENT_ID,
    issuer: `https://login.microsoftonline.com/${tid}/v2.0`,
  });

  // email を検証し、セッション JWT を発行して返す
  const email = (payload.preferred_username ?? payload.email ?? '').toLowerCase();
  // ... (ドメインチェック、クリエイター作成/取得、JWT 発行)

  return { status: 200, jsonBody: { role, creatorId, name } };
}

app.http('auth-entra', {
  methods: ['POST'],
  route: 'auth/entra',
  handler,
});
```

---

### 3-4. `api/src/services/blobService.ts` — Blob Storage サービス

共有キー認証が無効なストレージアカウントに対して、サービスプリンシパル（`ClientSecretCredential`）で接続する。

```typescript
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential, ClientSecretCredential } from '@azure/identity';

const connectionString = process.env.STORAGE_CONNECTION_STRING ?? 'UseDevelopmentStorage=true';
const storageAccountName = process.env.STORAGE_ACCOUNT_NAME;

/**
 * Azure AD 認証用クレデンシャルを返す。
 * AZURE_CLIENT_ID / AZURE_CLIENT_SECRET / AZURE_TENANT_ID が揃っていれば
 * ClientSecretCredential（サービスプリンシパル）を使用。
 * それ以外は DefaultAzureCredential（マネージド ID 等）にフォールバック。
 */
function getCredential(): ClientSecretCredential | DefaultAzureCredential {
  const clientId = process.env.AZURE_CLIENT_ID?.trim();
  const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim();
  const tenantId = process.env.AZURE_TENANT_ID?.trim();
  if (clientId && clientSecret && tenantId) {
    return new ClientSecretCredential(tenantId, clientId, clientSecret);
  }
  return new DefaultAzureCredential();
}

function getClient(): BlobServiceClient {
  if (storageAccountName) {
    // ★ STORAGE_ACCOUNT_NAME が設定されている場合は AAD 認証を最優先
    //   （ストレージアカウントで共有キー認証が無効でも動作する）
    return new BlobServiceClient(
      `https://${storageAccountName}.blob.core.windows.net`,
      getCredential(),
    );
  }
  // ローカル開発: Azurite（接続文字列）
  return BlobServiceClient.fromConnectionString(connectionString);
}
```

#### SAS URL 生成（ユーザー委任キー方式）

共有キー認証が無効な場合、SAS URL の生成には `StorageSharedKeyCredential` ではなく `getUserDelegationKey` を使う。これには **`Storage Blob Delegator`** ロールが必要（`Storage Blob Data Contributor` だけでは不足）。

```typescript
// ❌ 共有キー認証無効環境では動作しない
const cred = new StorageSharedKeyCredential(accountName, accountKey);
const sasToken = generateBlobSASQueryParameters(sasValues, cred).toString();

// ✅ ユーザー委任キーを使う（AAD 認証 + Storage Blob Delegator ロールが必要）
const startsOn = new Date(Date.now() - 5 * 60 * 1000);
const expiresOn = new Date(Date.now() + 60 * 60 * 1000);
const userDelegationKey = await getClient().getUserDelegationKey(startsOn, expiresOn);
const sasToken = generateBlobSASQueryParameters(
  sasValues,
  userDelegationKey,
  storageAccountName,
).toString();
```

---

## 4. Azure 側の設定

### 4-1. Entra ID アプリ登録

| 設定項目 | 値 |
|----------|-----|
| **アプリケーション (クライアント) ID** | `9d6c95c2-7455-498a-a16b-154ca67e6258` |
| **サポートされるアカウントの種類** | 任意の組織ディレクトリ内のアカウント (マルチテナント) |
| **リダイレクト URI** | `https://agreeable-island-071ec5400.4.azurestaticapps.net` |
| **リダイレクト URI の種類** | SPA (Single Page Application) |

> ⚠️ **リダイレクト URI は `window.location.origin` と完全一致させる**。末尾に `/` を付けない。パスを含めない。

### 4-2. 環境変数

| 場所 | 変数名 | 値 |
|------|--------|-----|
| フロントエンド（`.env.local` / GitHub Secrets） | `VITE_ENTRA_CLIENT_ID` | `9d6c95c2-...` |
| バックエンド（SWA Application Settings） | `ENTRA_CLIENT_ID` | `9d6c95c2-...` |
| バックエンド（SWA Application Settings） | `AZURE_CLIENT_ID` | SP のクライアント ID |
| バックエンド（SWA Application Settings） | `AZURE_CLIENT_SECRET` | SP のクライアントシークレット |
| バックエンド（SWA Application Settings） | `AZURE_TENANT_ID` | Entra テナント ID |
| バックエンド（SWA Application Settings） | `STORAGE_ACCOUNT_NAME` | ストレージアカウント名 |

> `STORAGE_CONNECTION_STRING`（AccountKey 付き）を設定しても、`STORAGE_ACCOUNT_NAME` が設定されている場合は接続文字列は無視され `ClientSecretCredential` が使われる。

### 4-3. Storage Account 設定（共有キー認証を無効にする環境）

#### 必須の Azure 設定

| 設定 | 値 | 理由 |
|------|-----|------|
| `allowSharedKeyAccess` | `false` | ポリシー準拠。AccountKey 接続を禁止 |
| `publicNetworkAccess` | `Enabled` | SWA Free プランは VNet 非対応のためパブリック接続が必須 |

> ⚠️ **`publicNetworkAccess: Disabled` にすると SWA Free プランから接続できない**。  
> Azure Functions が VNet に統合できるのは Standard プラン以上のみ。

#### 必須の RBAC ロール（サービスプリンシパルに付与）

| ロール | 用途 |
|--------|------|
| `Storage Blob Data Contributor` | Blob の読み書き・削除 |
| `Storage Blob Delegator` | `getUserDelegationKey` による SAS URL 生成 |

```bash
# ロール付与（SP の Object ID を指定）
az role assignment create \
  --role "Storage Blob Data Contributor" \
  --assignee-object-id <SP_OBJECT_ID> \
  --assignee-principal-type ServicePrincipal \
  --scope "/subscriptions/<SUB>/resourceGroups/<RG>/providers/Microsoft.Storage/storageAccounts/<ACCOUNT>"

az role assignment create \
  --role "Storage Blob Delegator" \
  --assignee-object-id <SP_OBJECT_ID> \
  --assignee-principal-type ServicePrincipal \
  --scope "/subscriptions/<SUB>/resourceGroups/<RG>/providers/Microsoft.Storage/storageAccounts/<ACCOUNT>"
```

### 4-4. `staticwebapp.config.json`

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/assets/*"]
  }
}
```

`navigationFallback` により、ポップアップが `https://example.com/#code=...` に戻った際に `index.html` が返される。これは SPA + ポップアップフローの前提条件。

---

## 5. やってはいけないこと（失敗パターン集）

### ❌ パターン 1: ポップアップ内で `handleRedirectPromise()` を呼ぶ

```typescript
// ❌ 間違い
initPromise = instance.initialize().then(async () => {
  await instance.handleRedirectPromise(); // ← ハッシュが消費される
  msalInstance = instance;
  return instance;
});
```

**結果**: `handleRedirectPromise()` が URL ハッシュ（`#code=...&state=...`）を消費・クリアする。`broadcastResponseToMainFrame()` が送信するデータがなくなり、メインウィンドウの `loginPopup()` がタイムアウトする。

### ❌ パターン 2: ポップアップ内で MSAL を初期化する

```typescript
// ❌ 間違い — ポップアップでもこれが実行される
if (ENTRA_CLIENT_ID && typeof window !== 'undefined') {
  void ensureInitialized(); // ← ポップアップでも初期化が走る
}
```

**結果**: MSAL v5 の `initialize()` がポップアップ内で URL を解析し始め、リダイレクトブリッジとの競合が発生する。

**正しくは**:
```typescript
// ✅ ポップアップコールバックウィンドウでは初期化しない
if (ENTRA_CLIENT_ID && typeof window !== 'undefined' && !isPopupCallbackWindow()) {
  void ensureInitialized();
}
```

### ❌ パターン 3: ポップアップ内で `window.close()` を手動で呼ぶ（broadcastResponseToMainFrame なしで）

```typescript
// ❌ 間違い
if (isMsalCallbackPopup()) {
  await getInitializationPromise();
  window.close(); // ← メインウィンドウに何も送信せずに閉じる
}
```

**結果**: メインウィンドウの `loginPopup()` が認証レスポンスを受け取らず、タイムアウトする。スピナーが回り続ける。

### ❌ パターン 4: `redirectUri` にパスを含める

```typescript
// ❌ 間違い
redirectUri: window.location.origin + '/auth-popup.html',
```

**結果**: Entra アプリ登録のリダイレクト URI と一致しないと `AADSTS50011` エラーが発生する。

### ❌ パターン 5: `redirectUri` のページ（ポップアップの着地先）でフル SPA をマウントする

```typescript
// ❌ 間違い — ポップアップでも通常通り React をマウント
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
```

**結果**: AuthGuard が `/login` にリダイレクトし、URL ハッシュが消失する。ポップアップにログイン画面が表示される。

### ❌ パターン 6: API Functions で環境変数未設定時にトップレベルで throw する

```typescript
// ❌ 間違い — Functions ホスト全体がクラッシュする
const CLIENT_ID = process.env.ENTRA_CLIENT_ID;
if (!CLIENT_ID) throw new Error('ENTRA_CLIENT_ID is required'); // ← モジュール読み込み時に実行される
```

**結果**: この 1 つの関数のエラーが Azure Functions ホスト全体を停止させ、`/api/*` のすべてのエンドポイントが 404 になる。

**正しくは**: フォールバック値を使うか、リクエストハンドラー内でエラーを返す。

### ❌ パターン 7: `STORAGE_ACCOUNT_NAME` があっても接続文字列（AccountKey）を優先する

```typescript
// ❌ 間違い
function getClient() {
  if (connectionString.includes('AccountKey=')) {
    return BlobServiceClient.fromConnectionString(connectionString); // ← キー認証が無効なら 403
  }
  if (storageAccountName) {
    return new BlobServiceClient(url, new DefaultAzureCredential());
  }
}
```

**結果**: `allowSharedKeyAccess: false` のストレージアカウントに接続文字列でアクセスすると
`This request is not authorized to perform this operation` (403) エラーになる。

**正しくは**:
```typescript
// ✅ STORAGE_ACCOUNT_NAME が設定されていれば常に AAD 認証を最優先
function getClient() {
  if (storageAccountName) {
    return new BlobServiceClient(
      `https://${storageAccountName}.blob.core.windows.net`,
      getCredential(), // ClientSecretCredential または DefaultAzureCredential
    );
  }
  return BlobServiceClient.fromConnectionString(connectionString); // Azurite のみ
}
```

### ❌ パターン 8: `DefaultAzureCredential` をそのまま使い SP が選ばれることを期待する

```typescript
// ❌ 信頼性が低い
const credential = new DefaultAzureCredential();
```

**結果**: `DefaultAzureCredential` は内部で複数の認証方式を順番に試みる。SWA Free プランの環境変数が正しく設定されていても、実行順序によって意図しない認証方式が選ばれ `Not authorized` エラーになることがある。

**正しくは**:
```typescript
// ✅ SP の環境変数が揃っていれば ClientSecretCredential を明示的に使う
function getCredential() {
  const clientId = process.env.AZURE_CLIENT_ID?.trim();
  const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim();
  const tenantId = process.env.AZURE_TENANT_ID?.trim();
  if (clientId && clientSecret && tenantId) {
    return new ClientSecretCredential(tenantId, clientId, clientSecret);
  }
  return new DefaultAzureCredential(); // マネージド ID 環境へのフォールバック
}
```

### ❌ パターン 9: SAS 生成に `StorageSharedKeyCredential` を使う（共有キー認証無効環境）

```typescript
// ❌ allowSharedKeyAccess: false の環境では動作しない
const cred = new StorageSharedKeyCredential(accountName, accountKey);
generateBlobSASQueryParameters(sasValues, cred);
```

**結果**: `403 This request is not authorized` エラー。

**正しくは**: `getUserDelegationKey` を使ったユーザー委任 SAS に切り替える（`Storage Blob Delegator` ロールが必要）。

### ❌ パターン 10: Storage Account の `publicNetworkAccess` を無効にする（SWA Free プラン）

```bash
# ❌ SWA Free プランでは Functions から接続できなくなる
az storage account update --public-network-access Disabled
```

**結果**: SWA Free プランの Azure Functions は VNet に統合できないため、パブリックネットワーク経由でしかストレージにアクセスできない。`publicNetworkAccess: Disabled` にすると **すべての Blob 操作が 403 エラー**になる。

**正しくは**: `publicNetworkAccess: Enabled` のまま、`allowSharedKeyAccess: false` + RBAC でアクセス制御する。

---

## 6. トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| ポップアップが閉じない（「Completing sign-in...」表示のまま） | `broadcastResponseToMainFrame()` が呼ばれていない | `main.tsx` のポップアップ分岐で `@azure/msal-browser/redirect-bridge` をインポートして呼ぶ |
| ポップアップは閉じるがスピナーが回り続ける | ポップアップ内で MSAL が初期化され URL ハッシュが消費された | `msalService.ts` でポップアップウィンドウでの eager init をスキップする |
| ポップアップにログイン画面が表示される | React アプリがポップアップ内でマウントされ `/login` にリダイレクトされた | `main.tsx` でポップアップ検出し React をマウントしない |
| `interaction_in_progress` エラー | 前回の認証が途中で中断された | sessionStorage/localStorage から `interaction.status` キーを削除 |
| `AADSTS50011` エラー | `redirectUri` が Entra アプリ登録と不一致 | `redirectUri: window.location.origin` にし、Entra 登録と一致させる |
| `/api/auth/me` が 404 | API Functions ホストがクラッシュ | `auth-entra.ts` のトップレベル throw を除去 |
| ポップアップが「about:blank」のまま | MSAL の初期化が完了する前に `loginPopup()` が呼ばれた | `ensureInitialized()` を await してから `loginPopup()` を呼ぶ |
| `Storage error: This request is not authorized` (403) | ① 接続文字列（AccountKey）が最優先になっている ② RBAC ロール未付与 ③ `publicNetworkAccess: Disabled` | ① `STORAGE_ACCOUNT_NAME` を優先して `ClientSecretCredential` を使う ② SP に `Storage Blob Data Contributor` + `Storage Blob Delegator` を付与 ③ `az storage account update --public-network-access Enabled` |
| `Storage error: Key based authentication not permitted` | `allowSharedKeyAccess: false` なのに ConnectionString（AccountKey）でクライアントを作成している | `getClient()` で `storageAccountName` チェックを最優先にし AAD 認証パスを通す |
| SAS URL 生成が `403` / `Not authorized` | `Storage Blob Delegator` ロール未付与 | SP に `Storage Blob Delegator` ロールを付与する |
| `ENTRA_CLIENT_ID missing` (500) | SWA Application Settings に `ENTRA_CLIENT_ID` が設定されていない | `az staticwebapp appsettings set` で設定（再デプロイ不要・即時反映） |
| すべての `/api/*` が 401 または 404 | Functions モジュール初期化時に `getRequiredEnv()` が throw している | 環境変数の参照をモジュールトップレベルから関数内（リクエスト処理時）に移動（遅延評価）|

---

## 7. チェックリスト

### 新規プロジェクトでの実装チェックリスト

- [ ] `@azure/msal-browser` v5.x をインストール
- [ ] `VITE_ENTRA_CLIENT_ID` を `.env.local` に設定
- [ ] `ENTRA_CLIENT_ID` を SWA Application Settings に設定
- [ ] Entra アプリ登録で SPA リダイレクト URI を `window.location.origin` に設定
- [ ] `msalService.ts` を作成:
  - [ ] `isPopupCallbackWindow()` でポップアップ検出
  - [ ] ポップアップウィンドウでは eager init をスキップ
  - [ ] `handleRedirectPromise()` は呼ばない
  - [ ] `redirectUri` は `window.location.origin`
- [ ] `main.tsx` を修正:
  - [ ] `isMsalCallbackPopup()` でポップアップコールバックを検出
  - [ ] ポップアップの場合: React をマウントせず `broadcastResponseToMainFrame()` を呼ぶ
  - [ ] メインウィンドウの場合: 通常通り React をマウント
- [ ] API `auth-entra.ts` を作成:
  - [ ] `idToken` を `jose` ライブラリで検証
  - [ ] トップレベルで throw しない
  - [ ] `ENTRA_CLIENT_ID` 未設定時はリクエストハンドラー内で 500 を返す
- [ ] `blobService.ts` を作成:
  - [ ] `STORAGE_ACCOUNT_NAME` が設定されていれば `ClientSecretCredential` を最優先
  - [ ] `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` / `AZURE_TENANT_ID` が揃っていれば `ClientSecretCredential`、それ以外は `DefaultAzureCredential`
  - [ ] SAS URL 生成は `getUserDelegationKey`（ユーザー委任キー）方式を使用
- [ ] Azure Storage Account を設定:
  - [ ] `publicNetworkAccess: Enabled`（SWA Free プランは VNet 非対応）
  - [ ] `allowSharedKeyAccess: false`（RBAC のみでアクセス制御）
  - [ ] SP に `Storage Blob Data Contributor` ロールを付与
  - [ ] SP に `Storage Blob Delegator` ロールを付与（SAS URL 生成に必要）
- [ ] SWA Application Settings に以下を設定:
  - [ ] `ENTRA_CLIENT_ID`
  - [ ] `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` / `AZURE_TENANT_ID`
  - [ ] `STORAGE_ACCOUNT_NAME`
- [ ] ビルド後にポップアップフローをテスト:
  - [ ] ポップアップが開く
  - [ ] Microsoft ログイン完了後、ポップアップが自動で閉じる
  - [ ] メインウィンドウのログインが完了する
  - [ ] ログイン後に Blob Storage の読み書きが正常に動作する

---

## 参考リンク

- [MSAL.js v5 Migration Guide](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/v5-migration.md)
- [`@azure/msal-browser/redirect-bridge` API](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-browser/src/redirect_bridge)
- [Microsoft Entra ID アプリ登録](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps)
- [Azure Static Web Apps 構成](https://learn.microsoft.com/azure/static-web-apps/configuration)
