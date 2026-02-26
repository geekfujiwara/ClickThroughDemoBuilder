# Click Through Demo Builder — Azure 再デプロイ計画

**Status**: `Deployed`  
**作成日**: 2026-02-25  
**シナリオ**: REDEPLOY（Azure リソースを誤削除後の再作成）

---

## 対象リソース

| リソース | 名前 | SKU | リージョン |
|---|---|---|---|
| Resource Group | `rg-clickthrough-prod` | — | East Asia |
| Static Web Apps | `swa-clickthrough-prod` | Free | East Asia |
| Storage Account | `stclickthroughprod` | Standard LRS | East Asia |
| Blob Containers | `projects`, `videos`, `masters`, `usage-logs` | — | — |

---

## 実行手順

### Phase 1: Azure リソース作成

- [ ] 1-1. Resource Group 作成
- [ ] 1-2. Azure Static Web Apps 作成（System Assigned Managed Identity 有効化）
- [ ] 1-3. Storage Account 作成
- [ ] 1-4. Blob コンテナ作成（projects / videos / masters / usage-logs）

### Phase 2: RBAC & App Settings

- [ ] 2-1. SWA の Managed Identity Principal ID を取得
- [ ] 2-2. Storage Blob Data Contributor ロールを SWA に付与
- [ ] 2-3. SWA App Settings 設定（STORAGE_ACCOUNT_NAME, JWT_SECRET, ENTRA_CLIENT_ID, APP_URL）

### Phase 3: GitHub Secrets 更新

- [ ] 3-1. SWA デプロイトークン取得
- [ ] 3-2. GitHub Secrets 更新手順の案内（`AZURE_STATIC_WEB_APPS_API_TOKEN`）

### Phase 4: デプロイ

- [ ] 4-1. `git push origin main` → GitHub Actions で自動デプロイ

---

## 注意事項

- `JWT_SECRET` は 32 文字以上のランダム文字列が必要（既存の値があれば再利用を推奨）
- `ENTRA_CLIENT_ID` は削除前と同じ App Registration の値を使用
- App Settings の `APP_URL` は SWA 作成後に確定するホスト名を設定
