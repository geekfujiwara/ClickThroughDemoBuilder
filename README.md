# Click Through Demo Builder

動画上にクリックポイントを配置して、操作手順を体験できるインタラクティブデモを作成・再生する Web アプリです。

## 主な機能

- デモ作成（動画アップロード、クリックポイント編集、説明表示スタイル設定）
- デモ再生（手動再生開始、クリックポイント待機、前CP移動、タイムラインスライダー）
- グループ管理（グループマスター作成/編集/削除、デモへのグループ割当、一覧フィルター）
- デモ利用ログ（デモID・名称・グループ・IP・拠点推定）

## 技術スタック

- Frontend: React + TypeScript + Vite + Fluent UI
- Backend: Azure Functions (Node.js/TypeScript)
- Storage: Azure Blob Storage
- Hosting: Azure Static Web Apps

## ローカル開発

### Frontend

```bash
npm ci
npm run dev
```

### API

```bash
cd api
npm ci
npm run build
npm start
```

`api/local.settings.sample.json` を参考に `api/local.settings.json` を設定してください。

## ビルド

```bash
npm run build
cd api && npm run build
```

## デプロイ

`main` ブランチへの push で GitHub Actions から Azure Static Web Apps へ自動デプロイされます。

- Workflow: `.github/workflows/deploy.yml`

## 使い始めガイド（パスワード設定と反映）

1. ローカル用設定を作成

```bash
cd api
copy local.settings.sample.json local.settings.json
```

2. `api/local.settings.json` の値を設定

- `VIEWER_PASSWORD`: 視聴者ログイン用パスワード
- `DESIGNER_PASSWORD`: 管理者ログイン用パスワード
- `JWT_SECRET`: 32文字以上のランダム文字列

3. ローカル反映

```bash
cd api
npm start
```

4. 本番反映（GitHub Secrets 経由）

- GitHub リポジトリの `Settings > Secrets and variables > Actions` に以下を登録
	- `VIEWER_PASSWORD`
	- `DESIGNER_PASSWORD`
	- `JWT_SECRET`
- ワークフロー実行時に Azure 側の API 設定へ適用される運用にしてください

5. 変更の反映確認

- `main` へ push 後、GitHub Actions の `Deploy to Azure Static Web Apps` が成功すること
- 反映後、Viewer/Designer のログインで新パスワードが有効であること

## ライセンス

社内利用 / プロジェクト用途に合わせて管理してください。
