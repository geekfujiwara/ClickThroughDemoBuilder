# Click Through Demo Builder — Azure デプロイ設計書

## 1. 概要

Click Through Demo Builder を Azure 上にサーバーレス構成でデプロイする。
現在のアプリはブラウザ内完結（IndexedDB + File System Access API）だが、
Azure 移行により以下を実現する。

- **クラウド上でのホスティング・共有**
- **2種類のユーザーの認証分離**（デモ体験者 / デザイナー）
- **Blob Storage によるコスト最適化**されたストレージ
- **Application Insights による利用状況の可視化**

---

## 2. Azure サブスクリプション情報

| 項目 | 値 |
|---|---|
| Entra テナント ID | `<YOUR_TENANT_ID>` |
| Subscription ID | `<YOUR_SUBSCRIPTION_ID>` |
| デプロイユーザー | `<YOUR_DEPLOY_USER>` |
| GitHub リポジトリ | `<PRIVATE_REPOSITORY_URL>` |
| Viewer パスワード | `<SET_SECURE_VIEWER_PASSWORD>` |
| Designer パスワード | `<SET_SECURE_DESIGNER_PASSWORD>` |

---

## 3. アーキテクチャ全体図

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Azure Subscription                          │
│  Resource Group: rg-clickthrough-prod                               │
│                                                                      │
│  ┌──────────────────────────────┐   ┌──────────────────────────┐    │
│  │  Azure Static Web Apps       │   │ Application Insights     │    │
│  │  (Free/Standard プラン)      │   │ + Log Analytics          │    │
│  │                              │   │ Workspace                │    │
│  │  ┌────────────────────────┐  │   │                          │    │
│  │  │ フロントエンド (SPA)   │  │   │ ・ページビュー           │    │
│  │  │ Vite + React ビルド    │  │──▶│ ・カスタムイベント       │    │
│  │  │ 静的ファイル配信       │  │   │ ・API レイテンシ         │    │
│  │  └────────────────────────┘  │   │ ・エラー率               │    │
│  │                              │   └──────────────────────────┘    │
│  │  ┌────────────────────────┐  │                                    │
│  │  │ API (Azure Functions)  │  │   ┌──────────────────────────┐    │
│  │  │ Node.js 20 (Managed)   │  │   │ Azure Blob Storage       │    │
│  │  │                        │──│──▶│ (Standard LRS)           │    │
│  │  │ /api/auth/*            │  │   │                          │    │
│  │  │ /api/projects/*        │  │   │ containers:              │    │
│  │  │ /api/videos/*          │  │   │  ├─ videos/              │    │
│  │  │                        │  │   │  │  └─ {projectId}/      │    │
│  │  └────────────────────────┘  │   │  │     └─ video.mp4      │    │
│  │                              │   │  └─ projects/            │    │
│  │  staticwebapp.config.json    │   │     └─ {projectId}.json  │    │
│  │  (ルーティング・認証制御)    │   │                          │    │
│  └──────────────────────────────┘   └──────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────┐                                    │
│  │ Azure Key Vault              │                                    │
│  │ (パスワード・接続文字列管理) │                                    │
│  └──────────────────────────────┘                                    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. リソース一覧と命名規則

| リソース | 名前 | SKU / プラン | 用途 |
|---|---|---|---|
| Resource Group | `rg-clickthrough-prod` | — | 全リソースの格納 |
| Static Web Apps | `swa-clickthrough-prod` | Free プラン | SPA + API ホスティング |
| Storage Account | `stclickthroughprod` | Standard LRS / Hot | 動画・プロジェクト JSON |
| Application Insights | `appi-clickthrough-prod` | — | テレメトリ・利用状況可視化 |
| Log Analytics Workspace | `log-clickthrough-prod` | Per-GB (従量課金) | AI のバックエンド |
| Key Vault | `kv-clickthrough-prod` | Standard | シークレット管理 |

### 月額コスト概算

| リソース | 概算コスト (月) | 備考 |
|---|---|---|
| Static Web Apps (Free) | ¥0 | 1アプリ, 帯域 100GB/月 |
| Storage Account (LRS Hot) | ~¥500〜3,000 | 動画サイズ・アクセス頻度依存 |
| Application Insights | ~¥0〜500 | 5GB/月 無料枠内想定 |
| Log Analytics | ~¥0〜500 | 5GB/月 無料枠内想定 |
| Key Vault | ~¥50〜100 | シークレットアクセス回数依存 |
| Azure Functions (SWA Managed) | ¥0 | SWA に含まれる |
| **合計** | **~¥550〜4,100** | 利用量により変動 |

> **コスト最適化ポイント**:
> - Static Web Apps Free プランに Azure Functions が同梱 → 別途 Functions を立てない
> - Blob Storage は Standard LRS (最安冗長) + Hot ティア
> - Application Insights は 5GB/月 無料枠内に収まるよう、サンプリングレートを調整
> - Key Vault は Secret のみ使用（Certificate/Key 不使用）

---

## 5. 認証設計

### 5.1 概要

2 種類の固定パスワード認証を、Azure Functions (SWA API) + セッションクッキーで実装する。
Entra ID (Azure AD) は使わず、シンプルな固定パスワード認証とする。

```
ユーザー種別:
  1. Viewer (デモ体験者)  → /viewer/login → パスワード入力 → /player/:projectId
  2. Designer (デザイナー) → /admin/login  → パスワード入力 → / (ホーム), /projects, /designer
```

### 5.2 認証フロー

```
┌─────────┐     POST /api/auth/login          ┌───────────────┐
│ ログイン │ ─── { role, password } ──────────▶│ Azure Function │
│ ページ   │                                   │                │
│          │ ◀── Set-Cookie: session=JWT ──────│ Key Vault から │
│          │     (HttpOnly, Secure, SameSite)  │ パスワード検証 │
└─────────┘                                    └───────────────┘

┌─────────┐     GET /api/projects              ┌───────────────┐
│ SPA     │ ─── Cookie: session=JWT ──────────▶│ Azure Function │
│          │                                    │                │
│          │ ◀── 200 or 401 ──────────────────│ JWT 検証       │
└─────────┘                                    │ role チェック   │
                                               └───────────────┘
```

### 5.3 Key Vault シークレット

| シークレット名 | 用途 |
|---|---|
| `VIEWER_PASSWORD` | デモ体験者用の固定パスワード |
| `DESIGNER_PASSWORD` | デザイナー用の固定パスワード |
| `JWT_SECRET` | セッション JWT の署名鍵 |
| `STORAGE_CONNECTION_STRING` | Blob Storage 接続文字列 |

### 5.4 ルーティング・アクセス制御

`staticwebapp.config.json` でルートを制御:

```jsonc
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/assets/*"]
  },
  "routes": [
    // Viewer ログインページ（認証不要）
    { "route": "/viewer/login", "allowedRoles": ["anonymous"] },
    // Admin ログインページ（認証不要）
    { "route": "/admin/login", "allowedRoles": ["anonymous"] },
    // API は Functions 側で認証制御
    { "route": "/api/*", "allowedRoles": ["anonymous"] },
    // Player ページ（Viewer/Designer 両方利用可）— API レベルで認証チェック
    { "route": "/player/*", "allowedRoles": ["anonymous"] },
    // その他のページ（認証不要だが、API 呼び出し時に認証チェック）
    { "route": "/*", "allowedRoles": ["anonymous"] }
  ],
  "responseOverrides": {
    "401": { "redirect": "/viewer/login" }
  }
}
```

> **設計方針**: SWA のルート制御はフロントのルーティングに任せ、
> 実際のデータ保護は **API (Azure Functions) 側の JWT 検証** で担保する。
> フロントエンドは Cookie に JWT があるか判定し、なければログインページへリダイレクトする。

### 5.5 ログインページ設計

| ページ | パス | 入力項目 | 認証後リダイレクト先 |
|---|---|---|---|
| Viewer ログイン | `/viewer/login` | パスワードのみ | `/viewer/demos` (デモ一覧) |
| Designer ログイン | `/admin/login` | パスワードのみ | `/` (ホーム) |

---

## 6. API 設計 (Azure Functions)

### 6.1 エンドポイント一覧

Static Web Apps の Managed Functions として実装（`/api/` プレフィックス固定）。

| メソッド | パス | ロール | 説明 |
|---|---|---|---|
| `POST` | `/api/auth/login` | anonymous | ログイン (パスワード検証 → JWT Cookie 発行) |
| `POST` | `/api/auth/logout` | viewer/designer | ログアウト (Cookie 削除) |
| `GET` | `/api/auth/me` | viewer/designer | 現在のセッション情報取得 |
| `GET` | `/api/projects` | designer | プロジェクト一覧取得 |
| `GET` | `/api/projects/:id` | viewer/designer | プロジェクト詳細取得 |
| `POST` | `/api/projects` | designer | プロジェクト作成 |
| `PUT` | `/api/projects/:id` | designer | プロジェクト更新 |
| `DELETE` | `/api/projects/:id` | designer | プロジェクト削除 |
| `POST` | `/api/projects/:id/duplicate` | designer | プロジェクト複製 |
| `GET` | `/api/videos/:videoId` | viewer/designer | 動画ストリーミング取得 (Blob SAS URL リダイレクト) |
| `POST` | `/api/videos/upload` | designer | 動画アップロード (→ Blob Storage) |
| `DELETE` | `/api/videos/:videoId` | designer | 動画削除 |
| `GET` | `/api/demos` | viewer | 公開デモ一覧 (Viewer 用) |

### 6.2 Functions 実装構成

```
api/
├── src/
│   ├── functions/
│   │   ├── auth-login.ts          # POST /api/auth/login
│   │   ├── auth-logout.ts         # POST /api/auth/logout
│   │   ├── auth-me.ts             # GET /api/auth/me
│   │   ├── projects-list.ts       # GET /api/projects
│   │   ├── projects-get.ts        # GET /api/projects/:id
│   │   ├── projects-create.ts     # POST /api/projects
│   │   ├── projects-update.ts     # PUT /api/projects/:id
│   │   ├── projects-delete.ts     # DELETE /api/projects/:id
│   │   ├── projects-duplicate.ts  # POST /api/projects/:id/duplicate
│   │   ├── videos-get.ts          # GET /api/videos/:videoId
│   │   ├── videos-upload.ts       # POST /api/videos/upload
│   │   ├── videos-delete.ts       # DELETE /api/videos/:videoId
│   │   └── demos-list.ts          # GET /api/demos
│   ├── middleware/
│   │   └── auth.ts                # JWT 検証・ロールチェック
│   ├── services/
│   │   ├── blobService.ts         # Blob Storage 操作
│   │   └── projectService.ts      # プロジェクト CRUD (Blob JSON)
│   └── shared/
│       └── types.ts               # 共有型定義
├── host.json
├── local.settings.json
├── package.json
└── tsconfig.json
```

### 6.3 ランタイム

| 項目 | 値 |
|---|---|
| Functions ランタイム | Node.js 20 |
| プログラミングモデル | Azure Functions v4 (TypeScript) |
| デプロイ方式 | SWA Managed Functions (`/api` フォルダ) |

---

## 7. Blob Storage 設計

### 7.1 コンテナ設計

```
Storage Account: stclickthroughprod
├── Container: projects     (Private)
│   ├── {projectId}.json            ← プロジェクト設定 (JSON)
│   ├── {projectId}.json            
│   └── ...
├── Container: videos       (Private)
│   ├── {projectId}/
│   │   └── video.mp4 (or .webm)   ← 動画ファイル（プロジェクトごとに1つ）
│   └── ...
└── Container: thumbnails   (Private)
    ├── {projectId}.jpg             ← サムネイル画像
    └── ...
```

### 7.2 コスト最適化設定

| 設定 | 値 | 理由 |
|---|---|---|
| 冗長性 | LRS (ローカル冗長) | 最低コスト。デモ用途のため高可用性不要 |
| アクセス層 | Hot | 頻繁にアクセスされる動画ファイル |
| パブリックアクセス | すべて無効 | API 経由の SAS URL でのみアクセス |
| ライフサイクル管理 | 90日未アクセスで Cool 層へ移行 | 古い動画のストレージコスト削減 |
| 論理削除 | 7日間の論理削除 | 誤削除からの復旧 |
| バージョニング | 無効 | コスト削減 |

### 7.3 動画アクセス方式

動画は **SAS URL (Shared Access Signature)** で一時的な読み取り専用 URL を発行して配信する。

```
1. フロントエンド → GET /api/videos/{videoId}
2. Azure Function → Blob Storage から SAS URL 生成 (有効期限: 1時間)
3. フロントエンド ← 302 Redirect (SAS URL) or JSON { url: "https://..." }
4. ブラウザ → 直接 Blob Storage から動画をストリーミング再生
```

> **利点**: Azure Function が動画の中継をしないため、Functions の実行時間・帯域コストを削減。

### 7.4 動画アップロード方式

大きな動画ファイルを効率的にアップロードするため、**SAS URL による直接アップロード**を採用:

```
1. フロントエンド → POST /api/videos/upload (メタデータのみ)
2. Azure Function → アップロード用 SAS URL 生成 (有効期限: 30分)
3. フロントエンド ← { uploadUrl: "https://...", videoId: "..." }
4. フロントエンド → PUT 動画ファイル → 直接 Blob Storage へ
5. フロントエンド → PUT /api/projects/:id (videoId をプロジェクトに紐付け)
```

---

## 8. Application Insights 設計

### 8.1 テレメトリ収集項目

| カテゴリ | イベント名 | プロパティ | 収集対象 |
|---|---|---|---|
| ページビュー | `pageView` | route, role | フロントエンド |
| デモ再生 | `demo_play` | projectId, demoNumber, title | Viewer |
| デモ完了 | `demo_complete` | projectId, duration, stepsCompleted | Viewer |
| CP クリック | `cp_click` | projectId, cpId, cpOrder, timestamp | Viewer |
| プロジェクト作成 | `project_create` | projectId | Designer |
| プロジェクト保存 | `project_save` | projectId, cpCount | Designer |
| 動画アップロード | `video_upload` | projectId, fileSize, mimeType | Designer |
| ログイン | `auth_login` | role, success | 全般 |
| API エラー | `api_error` | endpoint, statusCode, message | API |

### 8.2 フロントエンド統合

```typescript
// src/services/telemetry.ts
import { ApplicationInsights } from '@microsoft/applicationinsights-web';

const appInsights = new ApplicationInsights({
  config: {
    connectionString: import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING,
    enableAutoRouteTracking: true,      // React Router のページビュー自動追跡
    autoTrackPageVisitTime: true,       // ページ滞在時間
    disableFetchTracking: false,        // fetch API の自動追跡
    enableCorsCorrelation: true,        // CORS リクエストの相関
    samplingPercentage: 50,             // コスト最適化: 50% サンプリング
  }
});
appInsights.loadAppInsights();

export function trackEvent(name: string, properties?: Record<string, string>) {
  appInsights.trackEvent({ name }, properties);
}

export function trackException(error: Error) {
  appInsights.trackException({ exception: error });
}
```

### 8.3 API (Functions) 統合

```typescript
// api/src/shared/telemetry.ts
import { defaultClient, setup } from 'applicationinsights';

setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING).start();

export function trackApiEvent(name: string, properties?: Record<string, string>) {
  defaultClient.trackEvent({ name, properties });
}
```

### 8.4 ダッシュボード (Azure Monitor Workbook)

| ビュー | 表示内容 |
|---|---|
| 利用概要 | DAU/MAU、セッション数、ページビュー数 |
| デモ利用状況 | デモ別再生回数、完了率、平均所要時間 |
| CP ヒートマップ | クリックポイントごとのクリック率 |
| エラー監視 | API エラー率、レスポンスタイム P50/P95/P99 |
| デザイナー活動 | プロジェクト作成・保存頻度、動画アップロード量 |

---

## 9. フロントエンド改修計画

### 9.1 現行 → Azure 対応の主要変更

| 領域 | 現行 (ローカル) | Azure 対応後 |
|---|---|---|
| データ保存 | IndexedDB | Blob Storage (API 経由) |
| 動画保存 | IndexedDB + File System Access | Blob Storage (SAS URL 直接アップロード) |
| 認証 | なし | JWT Cookie 認証 |
| ルーティング | `/`, `/projects`, `/designer`, `/player` | 既存 + `/viewer/login`, `/admin/login`, `/viewer/demos` |
| テレメトリ | なし | Application Insights SDK |

### 9.2 サービス層の差し替え

```
src/services/
├── apiClient.ts          ← NEW: fetch ラッパー (認証ヘッダー付き)
├── authService.ts        ← NEW: ログイン/ログアウト/セッション管理
├── projectService.ts     ← MODIFY: IndexedDB → API 呼び出しに変更
├── videoService.ts       ← MODIFY: IndexedDB → SAS URL アップロード/取得に変更
├── telemetry.ts          ← NEW: Application Insights
├── exportService.ts      ← KEEP: エクスポートはクライアント側で維持
└── db.ts                 ← REMOVE: IndexedDB は不要
    folderStorageService.ts ← REMOVE: File System Access は不要
```

### 9.3 新規ページ

| ページ | パス | 説明 |
|---|---|---|
| ViewerLoginPage | `/viewer/login` | デモ体験者ログイン (パスワード入力のみ) |
| AdminLoginPage | `/admin/login` | デザイナーログイン (パスワード入力のみ) |
| ViewerDemosPage | `/viewer/demos` | 公開デモ一覧 (カード形式、再生ボタンのみ) |

### 9.4 ルーティング変更

```tsx
// App.tsx (Azure 版)
<Routes>
  {/* 認証ページ（未認証でもアクセス可） */}
  <Route path="/viewer/login" element={<ViewerLoginPage />} />
  <Route path="/admin/login" element={<AdminLoginPage />} />

  {/* Viewer 用ページ（viewer ロール必要） */}
  <Route element={<AuthGuard role="viewer" />}>
    <Route path="/viewer/demos" element={<ViewerDemosPage />} />
    <Route path="/player/:projectId" element={<PlayerPage />} />
  </Route>

  {/* Designer 用ページ（designer ロール必要） */}
  <Route element={<AuthGuard role="designer" />}>
    <Route element={<AppLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/projects" element={<ProjectsPage />} />
    </Route>
    <Route path="/designer" element={<DesignerPage />} />
    <Route path="/designer/:projectId" element={<DesignerPage />} />
  </Route>
</Routes>
```

---

## 10. デプロイ手順

### 10.1 前提条件

```bash
# Azure CLI ログイン
az login --tenant <YOUR_TENANT_ID>

# サブスクリプション設定
az account set --subscription <YOUR_SUBSCRIPTION_ID>
```

### 10.2 リソース作成 (Azure CLI)

```bash
# 変数定義
RG="rg-clickthrough-prod"
LOCATION="japaneast"
SWA_NAME="swa-clickthrough-prod"
STORAGE_NAME="stclickthroughprod"
AI_NAME="appi-clickthrough-prod"
LOG_NAME="log-clickthrough-prod"
KV_NAME="kv-clickthrough-prod"

# 1. リソースグループ作成
az group create --name $RG --location $LOCATION

# 2. Log Analytics Workspace 作成
az monitor log-analytics workspace create \
  --resource-group $RG \
  --workspace-name $LOG_NAME \
  --location $LOCATION \
  --sku PerGB2018

# 3. Application Insights 作成
LOG_ID=$(az monitor log-analytics workspace show \
  --resource-group $RG \
  --workspace-name $LOG_NAME \
  --query id -o tsv)

az monitor app-insights component create \
  --app $AI_NAME \
  --location $LOCATION \
  --resource-group $RG \
  --workspace $LOG_ID \
  --application-type web

# 4. Storage Account 作成
az storage account create \
  --name $STORAGE_NAME \
  --resource-group $RG \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2 \
  --access-tier Hot \
  --min-tls-version TLS1_2 \
  --allow-blob-public-access false

# Blob コンテナ作成
az storage container create --account-name $STORAGE_NAME --name projects --auth-mode login
az storage container create --account-name $STORAGE_NAME --name videos --auth-mode login
az storage container create --account-name $STORAGE_NAME --name thumbnails --auth-mode login

# ライフサイクル管理ポリシー (90日で Cool 層へ)
cat > /tmp/lifecycle-policy.json << 'EOF'
{
  "rules": [
    {
      "name": "MoveToCoolAfter90Days",
      "enabled": true,
      "type": "Lifecycle",
      "definition": {
        "filters": {
          "blobTypes": ["blockBlob"],
          "prefixMatch": ["videos/"]
        },
        "actions": {
          "baseBlob": {
            "tierToCool": { "daysAfterLastAccessTimeGreaterThan": 90 }
          }
        }
      }
    }
  ]
}
EOF
az storage account management-policy create \
  --account-name $STORAGE_NAME \
  --resource-group $RG \
  --policy @/tmp/lifecycle-policy.json

# 5. Key Vault 作成
az keyvault create \
  --name $KV_NAME \
  --resource-group $RG \
  --location $LOCATION \
  --sku standard

# シークレット登録
az keyvault secret set --vault-name $KV_NAME --name VIEWER-PASSWORD --value "<SET_SECURE_VIEWER_PASSWORD>"
az keyvault secret set --vault-name $KV_NAME --name DESIGNER-PASSWORD --value "<SET_SECURE_DESIGNER_PASSWORD>"
az keyvault secret set --vault-name $KV_NAME --name JWT-SECRET --value "$(openssl rand -base64 48)"

STORAGE_CONN=$(az storage account show-connection-string \
  --name $STORAGE_NAME --resource-group $RG --query connectionString -o tsv)
az keyvault secret set --vault-name $KV_NAME --name STORAGE-CONNECTION-STRING --value "$STORAGE_CONN"

# 6. Static Web Apps 作成
az staticwebapp create \
  --name $SWA_NAME \
  --resource-group $RG \
  --location "eastasia" \
  --sku Free \
  --app-location "/" \
  --api-location "api" \
  --output-location "dist"

# 7. SWA アプリケーション設定 (Functions 環境変数)
AI_CONN=$(az monitor app-insights component show \
  --app $AI_NAME --resource-group $RG \
  --query connectionString -o tsv)

az staticwebapp appsettings set \
  --name $SWA_NAME \
  --resource-group $RG \
  --setting-names \
    "STORAGE_CONNECTION_STRING=$STORAGE_CONN" \
    "APPLICATIONINSIGHTS_CONNECTION_STRING=$AI_CONN" \
    "VIEWER_PASSWORD=@Microsoft.KeyVault(SecretUri=https://${KV_NAME}.vault.azure.net/secrets/VIEWER-PASSWORD)" \
    "DESIGNER_PASSWORD=@Microsoft.KeyVault(SecretUri=https://${KV_NAME}.vault.azure.net/secrets/DESIGNER-PASSWORD)" \
    "JWT_SECRET=@Microsoft.KeyVault(SecretUri=https://${KV_NAME}.vault.azure.net/secrets/JWT-SECRET)"
```

### 10.3 GitHub Actions によるCI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy to Azure Static Web Apps

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          VITE_APPINSIGHTS_CONNECTION_STRING: ${{ secrets.APPINSIGHTS_CONNECTION_STRING }}

      - name: Install API dependencies
        run: cd api && npm ci

      - name: Deploy to Azure Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/"
          api_location: "api"
          output_location: "dist"
          skip_app_build: true  # 上のステップでビルド済み
```

---

## 11. ディレクトリ構成 (Azure 対応後)

```
ClickThrough/
├── api/                                ← NEW: Azure Functions API
│   ├── src/
│   │   ├── functions/                  ← 各 API エンドポイント
│   │   ├── middleware/                 ← 認証ミドルウェア
│   │   ├── services/                   ← Blob Storage 操作
│   │   └── shared/                     ← 共有型・ユーティリティ
│   ├── host.json
│   ├── local.settings.json
│   ├── package.json
│   └── tsconfig.json
├── src/                                ← フロントエンド (既存 + 改修)
│   ├── components/
│   │   ├── auth/
│   │   │   ├── AuthGuard.tsx          ← NEW: 認証ガード
│   │   │   ├── ViewerLoginPage.tsx    ← NEW: Viewer ログイン
│   │   │   └── AdminLoginPage.tsx     ← NEW: Designer ログイン
│   │   ├── common/
│   │   ├── designer/
│   │   └── viewer/
│   │       └── ViewerDemosPage.tsx    ← NEW: Viewer デモ一覧
│   ├── services/
│   │   ├── apiClient.ts              ← NEW: API クライアント
│   │   ├── authService.ts            ← NEW: 認証サービス
│   │   ├── projectService.ts         ← MODIFY: API 呼び出しに変更
│   │   ├── videoService.ts           ← MODIFY: SAS URL 方式に変更
│   │   ├── telemetry.ts             ← NEW: Application Insights
│   │   └── exportService.ts          ← KEEP
│   ├── stores/
│   │   ├── authStore.ts              ← NEW: 認証状態管理
│   │   ├── projectStore.ts           ← MODIFY
│   │   └── designerStore.ts          ← KEEP
│   ├── pages/
│   ├── types/
│   ├── constants/
│   ├── utils/
│   ├── App.tsx                        ← MODIFY: ルーティング追加
│   └── main.tsx                       ← MODIFY: テレメトリ初期化
├── staticwebapp.config.json           ← NEW: SWA ルーティング設定
├── .github/workflows/deploy.yml        ← NEW: CI/CD
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 12. セキュリティ考慮事項

| 項目 | 対策 |
|---|---|
| パスワード保管 | Key Vault に格納、環境変数で参照 |
| JWT セキュリティ | HttpOnly + Secure + SameSite=Strict Cookie |
| JWT 有効期限 | Viewer: 24時間 / Designer: 8時間 |
| Blob Storage アクセス | Private + SAS URL (短い有効期限) |
| HTTPS | SWA が自動で TLS 終端 |
| CORS | SWA が自動管理 (同一オリジン) |
| 入力バリデーション | Functions 側で全入力をバリデーション |
| レート制限 | Azure Front Door / SWA の既定制限に依存 |
| Storage 暗号化 | Azure Storage のサービス側暗号化 (SSE) |

---

## 13. 環境変数一覧

### フロントエンド (.env)

| 変数名 | 用途 |
|---|---|
| `VITE_APPINSIGHTS_CONNECTION_STRING` | Application Insights 接続文字列 |

### API (SWA App Settings)

| 変数名 | 用途 |
|---|---|
| `STORAGE_CONNECTION_STRING` | Blob Storage 接続文字列 |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Application Insights 接続文字列 |
| `VIEWER_PASSWORD` | Viewer 固定パスワード |
| `DESIGNER_PASSWORD` | Designer 固定パスワード |
| `JWT_SECRET` | JWT 署名鍵 |

---

## 14. 開発環境 (ローカル)

### ローカル開発の構成

```bash
# 1. Azurite (ローカル Blob Storage エミュレータ)
npm install -g azurite
azurite --silent --location ./azurite-data

# 2. API ローカル起動
cd api
cp local.settings.sample.json local.settings.json  # 設定編集
npm start

# 3. フロントエンド開発サーバー
npm run dev
```

### api/local.settings.json

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "VIEWER_PASSWORD": "<SET_LOCAL_VIEWER_PASSWORD>",
    "DESIGNER_PASSWORD": "<SET_LOCAL_DESIGNER_PASSWORD>",
    "JWT_SECRET": "<SET_LOCAL_JWT_SECRET_MIN_32_CHARS>",
    "APPLICATIONINSIGHTS_CONNECTION_STRING": ""
  }
}
```

---

## 15. 移行スケジュール (参考)

| フェーズ | 作業内容 | 期間 |
|---|---|---|
| Phase 1 | Azure リソース作成 + API 骨格 (認証) | 1日 |
| Phase 2 | Blob Storage サービス + プロジェクト CRUD API | 1日 |
| Phase 3 | 動画アップロード/ストリーミング API | 1日 |
| Phase 4 | フロントエンド改修 (API 呼び出し化) | 2日 |
| Phase 5 | ログインページ + 認証ガード | 1日 |
| Phase 6 | Application Insights 統合 | 0.5日 |
| Phase 7 | CI/CD パイプライン + テスト | 0.5日 |
| Phase 8 | 本番デプロイ + 動作確認 | 0.5日 |
| **合計** | | **~7.5日** |
