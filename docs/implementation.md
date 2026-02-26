# FlowNote — 実装詳細ドキュメント

> 作成日: 2026-02-26  
> 対象: 認証 / CORS / ストレージ / デプロイ 全実装まとめ

---

## 目次

1. [認証アーキテクチャ概要](#1-認証アーキテクチャ概要)
2. [Entra ID アプリ登録](#2-entra-id-アプリ登録)
3. [フロントエンド認証 (MSAL.js)](#3-フロントエンド認証-msaljs)
4. [バックエンド認証 (JWT 検証)](#4-バックエンド認証-jwt-検証)
5. [Managed Identity によるストレージアクセス](#5-managed-identity-によるストレージアクセス)
6. [CORS 設定](#6-cors-設定)
7. [Azure インフラ構成](#7-azure-インフラ構成)
8. [ストレージポリシー制約と対処](#8-ストレージポリシー制約と対処)
9. [デプロイ方法](#9-デプロイ方法)
10. [環境変数一覧](#10-環境変数一覧)
11. [判明したトラブルと解決策](#11-判明したトラブルと解決策)
12. [Bicep 修正対応表](#12-bicep-修正対応表)

---

## 1. 認証アーキテクチャ概要

```
ブラウザ (MSAL.js @azure/msal-browser 3.x)
    │
    │  1. loginPopup()  →  Microsoft ログイン画面
    │  2. acquireTokenSilent() / acquireTokenPopup()
    │     スコープ: api://<CLIENT_ID>/Notes.ReadWrite
    │
    ▼
アクセストークン (JWT, RS256, 有効期限 1時間)
    │  Authorization: Bearer <token>
    ▼
Azure Functions (Python v2, Flex Consumption)
    │
    ├── lib/auth.py  → PyJWT で RS256 署名検証
    │   ・JWKS URI: https://login.microsoftonline.com/<TENANT_ID>/discovery/v2.0/keys
    │   ・audience: api://<CLIENT_ID>
    │   ・issuer:   https://login.microsoftonline.com/<TENANT_ID>/v2.0
    │   ・oid クレーム取得 → Blob パス分離に使用
    │
    ├── DefaultAzureCredential (System Assigned Managed Identity)
    │   → Azure Blob Storage へパスワードレスアクセス
    │
    └── DefaultAzureCredential
        → Azure SignalR Service へパスワードレスアクセス
```

**認証の責任分担:**

| レイヤー | 担当 | 実装 |
|---|---|---|
| ユーザー認証 | Entra ID | MSAL.js (OAuth2 Authorization Code + PKCE) |
| API 認可 | Azure Functions | `lib/auth.py` で JWT 検証 |
| ストレージアクセス | Azure Functions | Managed Identity + RBAC |
| SignalR アクセス | Azure Functions | Managed Identity + RBAC |

---

## 2. Entra ID アプリ登録

### 2.1 前提リソース

| 項目 | 値 |
|---|---|
| テナント ID | `f092b281-d5e8-40dd-9bc0-198b375b0e7a` |
| クライアント ID | `c5a9dd52-f594-40fb-85ad-3d990aee769c` |
| リダイレクト URI | `https://thankful-plant-0e5dacc0f.1.azurestaticapps.net` (SPA型) |

### 2.2 必須設定項目

#### プラットフォーム設定

| 項目 | 値 | 注意 |
|---|---|---|
| プラットフォーム種別 | **Single-Page Application (SPA)** | ❌ "Web" 型では cross-origin token redemption エラー (AADSTS9002326) |
| リダイレクト URI | `https://thankful-plant-0e5dacc0f.1.azurestaticapps.net` | SPA 型で登録 |
| リダイレクト URI (開発) | `http://localhost:5173` | SPA 型で登録 |
| アクセストークン | チェック不要 (PKCE フローのため) | |
| ID トークン | チェック不要 (PKCE フローのため) | |

> **重要:** "Web" プラットフォームでリダイレクト URI を登録すると `AADSTS9002326: cross-origin token redemption is permitted only for the 'Single-Page Application'` エラーが発生する。必ず **SPA** で登録すること。

#### API スコープ (oauth2PermissionScopes) の登録

Azure ポータル「アプリの登録 → API の公開 → スコープの追加」で以下を登録:

| 設定 | 値 |
|---|---|
| スコープ名 | `Notes.ReadWrite` |
| 同意可能なユーザー | 管理者とユーザー |
| 表示名 | ノートの読み書き |
| 説明 | FlowNote のノートを読み書きするアクセス許可 |

**Application ID URI:** `api://c5a9dd52-f594-40fb-85ad-3d990aee769c`

> **重要:** `oauth2PermissionScopes` が空のまま `api://<clientId>/Notes.ReadWrite` をリクエストすると `AADSTS65005: The application does not have any defined permission scopes` エラーが発生する。

#### アクセストークンバージョン

「マニフェスト」タブで `accessTokenAcceptedVersion` を `2` に設定:

```json
{
  "accessTokenAcceptedVersion": 2
}
```

これにより issuer が `https://login.microsoftonline.com/<tenant>/v2.0` (v2.0 形式) になる。

### 2.3 Entra ID 設定チェックリスト

```
□ プラットフォームが "Single-Page Application" (SPA)
□ リダイレクト URI が SPA として登録済み (Web型ではない)
□ 「API の公開」で Notes.ReadWrite スコープが存在する
□ accessTokenAcceptedVersion = 2 (マニフェスト)
□ 単一テナント (Single tenant) または フロントエンドと同テナント
```

---

## 3. フロントエンド認証 (MSAL.js)

### 3.1 ファイル構成

```
frontend/src/
  lib/
    auth.ts        ← MSAL 設定 + getAccessToken()
    api.ts         ← fetchWithAuth() でトークン自動付与
```

### 3.2 MSAL 設定 (`frontend/src/lib/auth.ts`)

```typescript
import {
  PublicClientApplication,
  Configuration,
  LogLevel,
  AccountInfo,
  SilentRequest,
  PopupRequest,
} from '@azure/msal-browser'

const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID as string
const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID as string
const apiScope = import.meta.env.VITE_ENTRA_API_SCOPE as string

const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,   // SPA 型と一致させる
  },
  cache: {
    cacheLocation: 'sessionStorage',       // localStorage よりセキュア
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (_level, message, containsPii) => {
        if (!containsPii) console.debug('[MSAL]', message)
      },
      logLevel: LogLevel.Warning,
    },
  },
}

export const msalInstance = new PublicClientApplication(msalConfig)

// ログインリクエスト: スコープ指定
export const loginRequest: PopupRequest = {
  scopes: [apiScope || `api://${clientId}/Notes.ReadWrite`],
}

// アクセストークン取得 (サイレントに失敗したらポップアップへフォールバック)
export async function getAccessToken(): Promise<string> {
  const accounts = msalInstance.getAllAccounts()
  if (accounts.length === 0) throw new Error('Not authenticated')

  const request: SilentRequest = {
    ...loginRequest,
    account: accounts[0] as AccountInfo,
  }

  try {
    const result = await msalInstance.acquireTokenSilent(request)
    return result.accessToken
  } catch {
    // リフレッシュトークン期限切れや同意要求時はポップアップへ
    const result = await msalInstance.acquireTokenPopup(request)
    return result.accessToken
  }
}
```

### 3.3 MSAL ポップアップ CORS 対策 (`staticwebapp.config.json`)

MSAL の `loginPopup()` / `acquireTokenPopup()` が使う `postMessage` フレームは
デフォルトで `Cross-Origin-Opener-Policy: same-origin` によってブロックされる。

**対処:** `frontend/public/staticwebapp.config.json` に以下を追加:

```json
{
  "globalHeaders": {
    "Cross-Origin-Opener-Policy": "unsafe-none"
  }
}
```

> **重要:** このファイルは `public/` に置くこと。`src/` に置いても Vite のビルド出力 `dist/` に自動コピーされない。

### 3.4 API 呼び出し (`frontend/src/lib/api.ts`)

```typescript
import { getAccessToken } from './auth'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// 全 API リクエストに Bearer トークンを自動付与
async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  return res
}

// 使用例
export async function saveNote(params: { id?: string; title: string; content: string }) {
  const res = await fetchWithAuth('/save', { method: 'POST', body: JSON.stringify(params) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
```

### 3.5 Zustand ストアの useEffect 依存配列に注意

❌ **バグパターン (React error #185 無限ループ):**

```typescript
// NG: ストアオブジェクト全体を deps に含めると毎レンダーで新参照
const { fetchNoteList, notes } = useNoteStore()
useEffect(() => { fetchNoteList() }, [fetchNoteList])  // 毎回再実行
```

✅ **正しいパターン:**

```typescript
// OK: selector で個別に取得 → 参照安定
const fetchNoteList = useNoteStore(s => s.fetchNoteList)
const notes = useNoteStore(s => s.notes)
useEffect(() => { fetchNoteList() }, [fetchNoteList])
```

---

## 4. バックエンド認証 (JWT 検証)

### 4.1 ファイル構成

```
backend/
  lib/
    auth.py        ← JWT 検証 + oid 抽出
    blob_client.py ← Blob CRUD (Managed Identity)
  functions/
    save_note.py
    list_notes.py
    load_note.py
    delete_note.py
```

### 4.2 JWT 検証実装 (`backend/lib/auth.py`)

```python
import os
import jwt
import requests
from functools import lru_cache

TENANT_ID = os.environ.get("ENTRA_TENANT_ID", "")
CLIENT_ID = os.environ.get("ENTRA_CLIENT_ID", "")

JWKS_URI = f"https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys"
ISSUER   = f"https://login.microsoftonline.com/{TENANT_ID}/v2.0"
AUDIENCE = f"api://{CLIENT_ID}"

@lru_cache(maxsize=1)
def _get_jwks_client() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(JWKS_URI, cache_keys=True)

def verify_token(authorization_header: str | None) -> dict:
    """
    Authorization: Bearer <token> を受け取り、署名検証済み claims を返す。
    失敗時は ValueError を raise。
    """
    if not authorization_header or not authorization_header.startswith("Bearer "):
        raise ValueError("Authorization header is missing or invalid")

    token = authorization_header[len("Bearer "):]

    jwks_client = _get_jwks_client()
    signing_key = jwks_client.get_signing_key_from_jwt(token)

    payload = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],     # Entra ID は RS256 固定
        audience=AUDIENCE,        # api://<CLIENT_ID>
        issuer=ISSUER,            # v2.0 エンドポイント
    )
    return payload

def get_oid(claims: dict) -> str:
    """Entra ID の Object ID を取得 (Blob パス分離に使用)"""
    oid = claims.get("oid") or claims.get("sub")
    if not oid:
        raise ValueError("oid claim not found in token")
    return oid
```

### 4.3 各エンドポイントでの認証チェックパターン

```python
@bp.route(route="save", methods=["POST", "OPTIONS"])
def save_note(req: func.HttpRequest) -> func.HttpResponse:
    # CORS プリフライト
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=CORS_HEADERS)

    # 認証チェック (全エンドポイント共通)
    try:
        claims = verify_token(req.headers.get("Authorization"))
        oid = get_oid(claims)          # Blob パス: {oid}/{uuid}.md
    except ValueError as e:
        return unauthorized(str(e))    # 401 返却

    # ビジネスロジック...
```

### 4.4 削除の権限チェック (oid 比較)

```python
# DELETE /api/delete/{id}
blob_path = f"{oid_from_token}/{note_id}.md"
# Blob のパスにトークンの oid が含まれているかを検証
# → 別ユーザーのノートは 403 で拒否
```

### 4.5 CORS ヘッダー (関数内で設定)

```python
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
}
```

> Azure Functions の CORS はポータルまたは `host.json` でも設定可能だが、  
> OPTIONS メソッドの 204 レスポンスは関数内で明示的に処理する必要がある。

---

## 5. Managed Identity によるストレージアクセス

### 5.1 概要

Azure Functions の **System Assigned Managed Identity** を使い、  
ストレージアカウントの接続文字列 (Shared Key) を使わずに Blob にアクセスする。

```python
# backend/lib/blob_client.py
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient

credential = DefaultAzureCredential()

account_name = os.environ["AZURE_STORAGE_ACCOUNT_NAME"]
account_url  = f"https://{account_name}.blob.core.windows.net"

blob_service_client = BlobServiceClient(
    account_url=account_url,
    credential=credential,   # Managed Identity が自動的に使われる
)
```

### 5.2 RBAC ロール割り当て

| プリンシパル | リソース | ロール | 用途 |
|---|---|---|---|
| `func-flownote-flex4ev3` の MI | `stdatafw4hev3jvqwe4` (データ用) | Storage Blob Data Contributor | ノート読み書き |
| `func-flownote-flex4ev3` の MI | `stcontfw4hev3jvqwe4` (コンテンツ用) | Storage Blob Data Owner | デプロイパッケージ管理 |
| `func-flownote-flex4ev3` の MI | `stcontfw4hev3jvqwe4` | Storage Queue Data Contributor | Functions ホスト用 |
| `func-flownote-flex4ev3` の MI | `stcontfw4hev3jvqwe4` | Storage Table Data Contributor | Functions ホスト用 |

### 5.3 AzureWebJobsStorage を identity-based に設定する方法

接続文字列 (`DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...`) を使わず、  
`__*` サフィックス形式で Managed Identity 認証へ切り替える:

```
# Azure Functions アプリ設定
AzureWebJobsStorage__accountName    = stcontfw4hev3jvqwe4
AzureWebJobsStorage__credential     = managedidentity
AzureWebJobsStorage__blobServiceUri = https://stcontfw4hev3jvqwe4.blob.core.windows.net
AzureWebJobsStorage__queueServiceUri = https://stcontfw4hev3jvqwe4.queue.core.windows.net
AzureWebJobsStorage__tableServiceUri = https://stcontfw4hev3jvqwe4.table.core.windows.net
```

同様に `DEPLOYMENT_STORAGE_CONNECTION_STRING` も:

```
DEPLOYMENT_STORAGE_CONNECTION_STRING__accountName    = stcontfw4hev3jvqwe4
DEPLOYMENT_STORAGE_CONNECTION_STRING__credential     = managedidentity
DEPLOYMENT_STORAGE_CONNECTION_STRING__blobServiceUri = https://stcontfw4hev3jvqwe4.blob.core.windows.net
```

> **注意:** Consumption Y1 プランは `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING` が必須で、  
> identity-based 形式に対応していない。**Flex Consumption を使うこと。**

---

## 6. CORS 設定

### 6.1 Azure Functions ポータル設定

Azure Functions の「CORS」設定で以下のオリジンを許可:

```
https://thankful-plant-0e5dacc0f.1.azurestaticapps.net   ← 本番 SWA URL
http://localhost:5173                                     ← Vite 開発サーバー
http://localhost:7071                                     ← Functions ローカル
```

CLI での設定:
```powershell
az functionapp cors add `
  --name "func-flownote-flex4ev3" `
  --resource-group "rg-flownote-flownote" `
  --allowed-origins `
    "https://thankful-plant-0e5dacc0f.1.azurestaticapps.net" `
    "http://localhost:5173" `
    "http://localhost:7071"
```

### 6.2 `host.json` の CORS 設定

```json
{
  "version": "2.0",
  "extensions": {
    "http": {
      "cors": {
        "allowedOrigins": [
          "https://thankful-plant-0e5dacc0f.1.azurestaticapps.net",
          "http://localhost:5173",
          "http://localhost:7071"
        ],
        "supportCredentials": false
      }
    }
  }
}
```

> `supportCredentials: true` にすると `allowedOrigins` に `*` を使えなくなる。  
> Bearer トークンは `Authorization` ヘッダーで送るため、`credentials: 'include'` (Cookie) は不要。

### 6.3 関数内 OPTIONS ハンドラー (プリフライト対応)

```python
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
}

@bp.route(route="save", methods=["POST", "OPTIONS"])
def save_note(req):
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=CORS_HEADERS)
    # ...
```

### 6.4 CORS トラブルシューティング

| エラー | 原因 | 対処 |
|---|---|---|
| `has been blocked by CORS policy` | SWA の URL が許可オリジンにない | `az functionapp cors add` で SWA URL を追加 |
| `has been blocked by CORS policy` (503 時) | Function App 自体が起動していない → CORS ヘッダーが返せない | 503 の根本原因を修正してから再確認 |

---

## 7. Azure インフラ構成

### 7.1 デプロイ済みリソース

| リソース名 | 種別 | 値/役割 |
|---|---|---|
| `swa-flownote-fw4hev3jvqwe4` | Static Web Apps (Standard) | React フロントエンド。URL: `https://thankful-plant-0e5dacc0f.1.azurestaticapps.net` |
| `func-flownote-flex4ev3` | Functions (Flex Consumption FC1) | **本番バックエンド** (デプロイ成功済) |
| `func-flownote-fw4hev3jvqwe4` | Functions (Consumption Y1) | 旧バックエンド (503、後述のポリシー問題で使用不可) |
| `stdatafw4hev3jvqwe4` | Storage (Standard LRS) | ノートデータ保存用 |
| `stdeplfw4hev3jvqwe4` | Storage (Standard LRS) | Functions デプロイ用 (元: コンテンツ) |
| `stcontfw4hev3jvqwe4` | Storage (Standard LRS) | Functions ホスト / デプロイパッケージ用 |
| `sigr-flownote-*` | SignalR Service | リアルタイム通知 |
| `appi-flownote-*` | Application Insights | 監視 |

### 7.2 サブスクリプション情報

| 項目 | 値 |
|---|---|
| サブスクリプション ID | `d0b22a7f-8129-4a0d-bd5a-e8af107be62b` |
| リソースグループ | `rg-flownote-flownote` |
| テナント ID | `f092b281-d5e8-40dd-9bc0-198b375b0e7a` |

### 7.3 Managed Identity

| Function App | Principal ID (Object ID) |
|---|---|
| `func-flownote-flex4ev3` | `6f3f3f70-e6cf-4b35-ae51-9d9184579761` |
| `func-flownote-fw4hev3jvqwe4` | `a5d52a48-ff80-4159-9937-6ee3f5a54fec` |

---

## 8. ストレージポリシー制約と対処

### 8.1 テナントレベル Azure Policy の内容

このサブスクリプションには以下の **Azure Policy (テナントレベル)** が適用されており、  
**手動では変更・無効化できない:**

| ポリシー | 内容 | 影響 |
|---|---|---|
| `allowSharedKeyAccess: false` 強制 | キーベース接続文字列を使用した Blob/Queue/Table アクセスがすべて拒否 | 接続文字列での AzureWebJobsStorage が使用不可 |
| `publicNetworkAccess: Disabled` (初期値) | ストレージへのパブリックネットワークアクセスが無効 | Functions から Blob にアクセス不可 (Private Endpoint なし環境) |

> **注意:** `allowSharedKeyAccess: false` の下では `DefaultEndpointsProtocol=https;AccountName=X;AccountKey=Y` 形式の接続文字列は **403 AuthorizationFailure** で拒絶される。`listKeys()` で取得したキーも使用不可。

### 8.2 影響と対処一覧

| 影響 | 原因 | 対処 |
|---|---|---|
| Consumption Y1 Functions が 503 | `AzureWebJobsStorage` に接続文字列 → ポリシーで拒否 → ホスト起動失敗 | **Flex Consumption に移行** (identity-based 対応) |
| `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING` 未設定エラー | Consumption Y1 は Azure Files 接続文字列が必須 | **Flex Consumption を使用** (この設定不要) |
| `func publish` が 400 | AzureWebJobsStorage が無効で Kudu が起動不可 | Flex Consumption + identity-based 設定 |
| `az functionapp deployment source config-zip` が 403 | `publicNetworkAccess: Disabled` で Kudu から Blob にアクセス不可 | ストレージの `publicNetworkAccess` を `Enabled` に変更 |

### 8.3 実施した対処

```powershell
# 1. stcontfw4hev3jvqwe4 のパブリックアクセスを有効化
az storage account update `
  --name "stcontfw4hev3jvqwe4" `
  --resource-group "rg-flownote-flownote" `
  --public-network-access Enabled

# 2. stdeplfw4hev3jvqwe4 のパブリックアクセスを有効化
az storage account update `
  --name "stdeplfw4hev3jvqwe4" `
  --resource-group "rg-flownote-flownote" `
  --public-network-access Enabled

# 3. func-flownote-flex4ev3 に正しい Principal ID で RBAC 付与
$scope = "/subscriptions/.../storageAccounts/stcontfw4hev3jvqwe4"
az role assignment create `
  --assignee-object-id "6f3f3f70-e6cf-4b35-ae51-9d9184579761" `
  --assignee-principal-type ServicePrincipal `
  --role "Storage Blob Data Owner" `
  --scope $scope
```

> **備考:** `az role assignment list --assignee <principal-id>` の出力に別のPrincipal IDが表示されることがある (グループ経由の継承)。  
> 必ず `az functionapp show --query "identity.principalId"` で取得した ID を直接 `--assignee-object-id` で使用する。

---

## 9. デプロイ方法

### 9.1 フロントエンド (Static Web Apps)

```powershell
cd C:\FlowNote\frontend
npm run build

# デプロイトークン取得
$token = az staticwebapp secrets list `
  --name "swa-flownote-fw4hev3jvqwe4" `
  --resource-group "rg-flownote-flownote" `
  --query "properties.apiKey" -o tsv

# SWA CLI でデプロイ
npx @azure/static-web-apps-cli deploy dist `
  --deployment-token $token `
  --env production
```

### 9.2 バックエンド (Flex Consumption)

```powershell
cd C:\FlowNote\backend

# Core Tools v4 でデプロイ (--no-build: Linux向けパッケージ同梱済みのため)
func azure functionapp publish "func-flownote-flex4ev3" --no-build --python
```

**前提条件 (デプロイ成功に必要):**

1. `stcontfw4hev3jvqwe4` の `publicNetworkAccess: Enabled`
2. `func-flownote-flex4ev3` の MI (`6f3f3f70`) が `stcontfw4hev3jvqwe4` に `Storage Blob Data Owner` を持つ
3. `DEPLOYMENT_STORAGE_CONNECTION_STRING__*` アプリ設定が `stcontfw4hev3jvqwe4` を指している
4. `backend/.python_packages/lib/site-packages/` に Linux 向けパッケージが配置済み

### 9.3 Linux 向けパッケージの準備 (--no-build 用)

```powershell
# Linux 向けパッケージを .python_packages に展開 (WSL または Docker 推奨)
# または linux_packages/*.whl を --no-deps でインストール

pip install `
  --platform manylinux2014_x86_64 `
  --implementation cp `
  --python-version 311 `
  --only-binary=:all: `
  --target backend/.python_packages/lib/site-packages `
  -r backend/requirements.txt
```

### 9.4 失敗したデプロイ方法 (記録)

| コマンド | エラー | 理由 |
|---|---|---|
| `azd deploy backend` (Y1) | 400 WEBSITE_CONTENTAZUREFILECONNECTIONSTRING is empty | Consumption Y1 は接続文字列必須 |
| `func publish fw4hev3jvqwe4 --no-build` | AzureWebJobsStorage invalid | キーベース設定がポリシーで拒否 |
| `az functionapp deployment source config-zip fw4hev3jvqwe4` | Kudu 400 | WEBSITE_CONTENTAZUREFILECONNECTIONSTRING 未設定 |
| `func publish flex4ev3 --no-build` (初回) | Kudu Legion 403 | `publicNetworkAccess: Disabled` + RBAC 未設定 |
| `azd up` (japaneast/eastasia/eastus2) | exit code 1 | ポリシー違反でストレージ作成時に rollback |

---

## 10. 環境変数一覧

### 10.1 バックエンド (Azure Functions アプリ設定)

| 変数名 | 値 | 説明 |
|---|---|---|
| `FUNCTIONS_EXTENSION_VERSION` | `~4` | Functions ランタイムバージョン |
| `FUNCTIONS_WORKER_RUNTIME` | `python` | Python ワーカー |
| `AzureWebJobsStorage__accountName` | `stcontfw4hev3jvqwe4` | ホスト用ストレージ (identity-based) |
| `AzureWebJobsStorage__credential` | `managedidentity` | MI 認証指定 |
| `AzureWebJobsStorage__blobServiceUri` | `https://stcontfw4hev3jvqwe4.blob.core.windows.net` | |
| `AzureWebJobsStorage__queueServiceUri` | `https://stcontfw4hev3jvqwe4.queue.core.windows.net` | |
| `AzureWebJobsStorage__tableServiceUri` | `https://stcontfw4hev3jvqwe4.table.core.windows.net` | |
| `DEPLOYMENT_STORAGE_CONNECTION_STRING__accountName` | `stcontfw4hev3jvqwe4` | デプロイ用ストレージ |
| `DEPLOYMENT_STORAGE_CONNECTION_STRING__credential` | `managedidentity` | |
| `DEPLOYMENT_STORAGE_CONNECTION_STRING__blobServiceUri` | `https://stcontfw4hev3jvqwe4.blob.core.windows.net` | |
| `AZURE_STORAGE_ACCOUNT_NAME` | `stdatafw4hev3jvqwe4` | ノートデータ保存先 |
| `AZURE_STORAGE_CONTAINER_NAME` | `flownotes` | コンテナ名 |
| `ENTRA_CLIENT_ID` | `c5a9dd52-f594-40fb-85ad-3d990aee769c` | JWT 検証用 audience |
| `ENTRA_TENANT_ID` | `f092b281-d5e8-40dd-9bc0-198b375b0e7a` | JWT 検証用 issuer |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | `InstrumentationKey=8bd7bbb7-...` | 監視 |
| `AzureSignalRConnectionString` | `Endpoint=https://sigr-...` | SignalR 接続 |

### 10.2 フロントエンド (.env / Vite 環境変数)

| 変数名 | 値 | 説明 |
|---|---|---|
| `VITE_API_BASE_URL` | `https://func-flownote-flex4ev3.azurewebsites.net` | APIベースURL |
| `VITE_ENTRA_CLIENT_ID` | `c5a9dd52-f594-40fb-85ad-3d990aee769c` | MSAL 設定 |
| `VITE_ENTRA_TENANT_ID` | `f092b281-d5e8-40dd-9bc0-198b375b0e7a` | MSAL 設定 |
| `VITE_ENTRA_API_SCOPE` | `api://c5a9dd52-f594-40fb-85ad-3d990aee769c/Notes.ReadWrite` | トークンスコープ |

---

## 11. 判明したトラブルと解決策

### 11.1 トラブル全記録

| # | 症状 | 根本原因 | 解決策 | ステータス |
|---|---|---|---|---|
| 1 | `AADSTS65005` Notes.ReadWrite スコープ不明 | Entra ID アプリに `oauth2PermissionScopes` が未登録 | ポータルで `Notes.ReadWrite` スコープを「API の公開」に追加 | ✅ 解決 |
| 2 | `AADSTS9002326` cross-origin token redemption error | Entra ID のリダイレクト URI が "Web" 型で登録されていた | プラットフォームを **SPA (Single-Page Application)** 型に変更 | ✅ 解決 |
| 3 | CORS blocked (最初) | Functions の許可オリジンに SWA URL が未設定 | `az functionapp cors add` で SWA URL 追加 | ✅ 解決 |
| 4 | CORS blocked (2回目、azd provision後) | `azd provision` で CORS 設定が上書き (Bicep に SWA URL なし) | 再度 `az functionapp cors add`、Bicep 修正で恒久対処が必要 | ✅ 暫定対処済 |
| 5 | JS ファイルが `application/octet-stream` | `staticwebapp.config.json` が `src/` にあり `dist/` に含まれない | ファイルを `public/` に移動 | ✅ 解決 |
| 6 | React error #185 無限ループ | `useEffect` deps に Zustand ストアオブジェクトを含めていた | selector で個別取得 (`useNoteStore(s => s.notes)`) | ✅ 解決 |
| 7 | Functions 503 (Consumption Y1) | `AzureWebJobsStorage` に接続文字列 → `allowSharedKeyAccess:false` ポリシーで拒否 → ホスト起動失敗 | `AzureWebJobsStorage__*` identity-based 形式に変更、Flex Consumption へ移行 | ✅ 暫定対処 |
| 8 | デプロイ 403 (Flex Consumption) | ① `publicNetworkAccess: Disabled` でストレージ不到達 ② RBAC のPrincipal IDが誤っていた | `publicNetworkAccess: Enabled` + 正しいPrincipal IDでIAM再設定 → `func publish` 成功 | ✅ 解決 |
| 9 | RBAC 確認時に別 Principal が表示 | `az role assignment list --assignee` がグループ継承ロールを返す | `az functionapp show --query "identity.principalId"` の値を `--assignee-object-id` で直接指定 | ✅ 解決 |

### 11.2 デプロイ後 Functions が空 (`[]`) の問題 (調査中)

`func publish` は成功、ホストは "Running" だが `/admin/functions` が `[]` を返す。

**確認事項:**

```powershell
# 1. ホストステータス確認
$key = "<master_key>"
Invoke-RestMethod "https://func-flownote-flex4ev3.azurewebsites.net/admin/host/status" `
  -Headers @{"x-functions-key"=$key}

# 2. ログ確認 (Flex Consumption は log stream 非対応)
# → App Insights でクエリ
az monitor app-insights query `
  --app "b5ce76e6-4b23-416e-af3a-d13d17c6af54" `
  --analytics-query "exceptions | where timestamp > ago(30m) | order by timestamp desc | take 20"
```

**想定される原因:**

1. `--no-build` デプロイで Python 依存関係が Linux 互換でなくモジュールインポートが失敗
2. `function_app.py` の import エラー (例: `azure.identity` が見つからない)
3. `stdatafw4hev3jvqwe4` の `publicNetworkAccess: Disabled` でワーカー起動時のSDK初期化が失敗

---

## 12. Bicep 修正対応表

現在の Bicep には以下の問題があり、`azd provision` を実行するたびに設定が元に戻る。

### 12.1 `infra/modules/functions.bicep` の修正箇所

#### 問題①: `listKeys()` による接続文字列設定 (Consumption Y1)

```bicep
// ❌ NG: allowSharedKeyAccess:false ポリシーで拒否される
var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${...};AccountKey=${deploymentStorage.listKeys().keys[0].value};...'

{
  name: 'AzureWebJobsStorage'
  value: storageConnectionString
}
```

```bicep
// ✅ OK: identity-based 形式 (Flex Consumption 用)
{
  name: 'AzureWebJobsStorage__accountName'
  value: contentStorage.name
}
{
  name: 'AzureWebJobsStorage__credential'
  value: 'managedidentity'
}
{
  name: 'AzureWebJobsStorage__blobServiceUri'
  value: 'https://${contentStorage.name}.blob.core.windows.net'
}
{
  name: 'AzureWebJobsStorage__queueServiceUri'
  value: 'https://${contentStorage.name}.queue.core.windows.net'
}
{
  name: 'AzureWebJobsStorage__tableServiceUri'
  value: 'https://${contentStorage.name}.table.core.windows.net'
}
```

#### 問題②: CORS に SWA URL が含まれない

```bicep
// ❌ NG: portal.azure.com のみ
cors: {
  allowedOrigins: ['https://portal.azure.com']
}
```

```bicep
// ✅ OK: SWA URL を追加
cors: {
  allowedOrigins: [
    'https://portal.azure.com'
    staticWebAppDefaultHostname  // SWA のホスト名を変数で参照
  ]
}
```

#### 問題③: ストレージの `publicNetworkAccess`

```bicep
// ✅ OK: デプロイ用ストレージはパブリックアクセスを許可
resource contentStorage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  properties: {
    publicNetworkAccess: 'Enabled'   // Disabled → Enabled
    allowSharedKeyAccess: false      // ポリシーに合わせ false のまま
    defaultToOAuthAuthentication: true
  }
}
```

### 12.2 Functions プランを Flex Consumption に変更する Bicep

```bicep
// Flex Consumption (FC1)
resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: flexPlan.id
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${contentStorage.properties.primaryEndpoints.blob}deploypackage'
          authentication: {
            type: 'SystemAssignedIdentity'  // 接続文字列不要
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 100
        instanceMemoryMB: 2048
      }
      runtime: {
        name: 'python'
        version: '3.11'
      }
    }
  }
}

// Flex Consumption プラン
resource flexPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true  // Linux
  }
}
```

---

*このドキュメントはセッション中に判明した実装詳細・トラブルシュートをすべてまとめたものです。*  
*Bicep の恒久修正は現在作業中です。*
