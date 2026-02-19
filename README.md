# Click Through Demo Builder

動画上にクリックポイントを配置して、操作手順を体験できるインタラクティブデモを作成・再生する Web アプリです。

## 主な機能

- **デモ作成**: 動画アップロード、クリックポイント編集、説明表示スタイル設定
- **デモ再生**: クリックポイント待機、前CP移動、タイムラインスライダー
- **グループ管理**: グループマスター作成/編集/削除、デモへのグループ割当/フィルター
- **利用ログ**: デモID・名称・グループ・IP・拠点推定ログ収集
- **Microsoft SSO**: `@microsoft.com` アカウントによるシングルサインオン（初回自動登録）

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React + TypeScript + Vite + Fluent UI v9 |
| バックエンド | Azure Functions v4 (Node.js 20 / TypeScript) |
| ストレージ | Azure Blob Storage (DefaultAzureCredential / RBAC) |
| ホスティング | Azure Static Web Apps |
| 認証 | Microsoft Entra ID (MSAL popup) + カスタム JWT セッション |

## ローカル開発

### 前提

- Node.js 20
- Azure Functions Core Tools v4
- Azure CLI (`az login` 済み) または Azurite（ローカルストレージエミュレーター）

### セットアップ

```bash
# 1. ルート依存関係インストール
npm ci

# 2. API 設定ファイル作成
cd api
copy local.settings.sample.json local.settings.json
# local.settings.json を編集して必要な値を設定 (下記参照)

# 3. API 依存関係インストール
npm ci
```

### `api/local.settings.json` の設定項目

| 変数名 | 説明 | デフォルト |
|---|---|---|
| `STORAGE_ACCOUNT_NAME` | Azure ストレージアカウント名 | 空（Azurite を使用） |
| `JWT_SECRET` | JWT 署名キー（32文字以上） | 要設定 |
| `ENTRA_CLIENT_ID` | Azure App Registration のクライアントID | 任意 |
| `APP_URL` | アプリの公開 URL | `http://localhost:4280` |
| `GRAPH_SENDER` | Graph API メール送信元アドレス | 任意 |

### 起動

```bash
# フロントエンド（別ターミナル）
npm run dev

# API（api/ ディレクトリ内）
cd api && npm run build && npm start
```

## ビルド

```bash
npm run build
cd api && npm run build
```

## デプロイ

`main` ブランチへの push で GitHub Actions (`.github/workflows/deploy.yml`) から Azure Static Web Apps へ自動デプロイされます。

### 本番環境の設定（Azure Portal / App Settings）

| 変数名 | 説明 |
|---|---|
| `STORAGE_ACCOUNT_NAME` | Azure ストレージアカウント名 |
| `JWT_SECRET` | JWT 署名キー（ランダム 32 文字以上） |
| `ENTRA_CLIENT_ID` | Azure App Registration のクライアントID |
| `APP_URL` | 公開 URL (`https://your-app.azurestaticapps.net`) |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Application Insights 接続文字列（任意） |

フロントエンドビルド用（GitHub Secrets）:

| Secret 名 | 説明 |
|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | SWA デプロイトークン |
| `APPINSIGHTS_CONNECTION_STRING` | Application Insights 接続文字列（任意） |
| `VITE_ENTRA_CLIENT_ID` | フロントエンド用クライアントID（任意） |

## 認証フロー

```
ログインページ
  └─ "Sign in with Microsoft" クリック
       └─ MSAL popup (Entra ID 認証画面)
            └─ ID トークン取得
                 └─ POST /api/auth/entra
                      └─ JWKS 署名検証 + @microsoft.com ドメイン確認
                           └─ クリエイター自動作成（初回のみ）
                                └─ JWT セッションクッキー発行 → ホームへ
```

## ライセンス

MIT License — 詳細は [LICENSE](LICENSE) ファイルを参照してください。
