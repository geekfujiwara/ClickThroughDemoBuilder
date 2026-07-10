# ClickThrough: ストレージ非公開対応 (Private Endpoint 移行 B) — 設計 / 進捗 / 教訓

> 目的: 会社ポリシーで `publicNetworkAccess=Disabled` が強制されるストレージに対し、
> **ウェブサイトからの動画視聴/アップロードを維持したまま**アクセスを復旧する。
> 方針 B = Private Endpoint 化 + バックエンド移設 + 動画の API プロキシ化。

最終更新: 2026-07-10

---

## 1. 背景 / 問題

- 症状: `Storage error: This request is not authorized to perform this operation` (403)。
- 原因(確定): 会社の **Azure Policy(Modify効果)** が Storage の `publicNetworkAccess=Disabled` を
  inline 強制。朝の enable ワークフローでは値が戻され、実質 Private のまま。
- アプリはブラウザが **SAS URL で Blob に直接アクセス**する設計のため、Private 化で全滅する。

## 2. 確定した事実 (診断済み)

### ガバナンスの正体 (2026-07-10 所有者ログインで確定)
- 環境は **Microsoft コーポレートテナント (Tenant Root Group: f092b281…, “Contoso”)**。
- Tenant Root MG に **MCAPSGov / SFI(Secure Future Initiative)** ガバナンスが割当:
  - **`StorageAccount_PublicNetwork_Modify`** (effect=modify) ← publicNetworkAccess=Disabled を強制(本件の直接原因)。
    displayName: “SFI - Disable public network access on Storage accounts (**excluding NSP configured resources**)”。
  - `StorageAccount_DisableLocalAuth_Modify` → allowSharedKeyAccess=false (共有キー禁止 → MI/AAD 必須)。
  - `StorageAccount_BlobAnonymousAccess_Modify` → 匿名アクセス禁止。
  - **MFA Enforcement for Resource Write/Delete** → ARM 書込/削除に MFA 必須。
  - **Block Azure RM Resource Creation** → **Classic リソースのみ拒否**(モダン VNet/PE/Func は作成可)。
- **PublicNetwork_Modify の対象は Storage/CosmosDB/KeyVault/SQL/AIFoundry のみ。Microsoft.Web は対象外** → **C1=No**。
- ⇒ 重要: **これは自己で例外不可な Microsoft コーポレートセキュリティポリシー**。方針 A(自己例外)は不可/不適切。

### ストレージ/ネットワークの現状

| 項目 | 結果 |
|---|---|
| publicNetworkAccess | Disabled (Modify 強制 → 変更しても inline で戻る) |
| NSP 関連付け | 無し (ただし NSP に載せれば Modify 対象外になる) |
| Private Endpoint | 無し |
| allowSharedKeyAccess | false (共有キー禁止) |
| フロント配信 | ブラウザ→SAS URL 直アクセス |

## 3. 環境制約チェックリスト (実装前に確定させる)

> ⚠ これらが確定するまで実装のインフラ部分には入らない。

| # | 確認項目 | なぜ重要か | 状態 | 結論 |
|---|---|---|---|---|
| C1 | **Microsoft.Web(Functions/App Service) の publicNetworkAccess を Disabled 強制するポリシーがあるか** | 公開バックエンドを作れるかが決まる | ✅ **No(Webは対象外)** | 案 **B-1** 採用可 |
| C2 | SWA(現行フロント/管理Functions)は公開で動作しているか | 公開 web 自体は許可されている証拠になる | ✅ 動作中 | 公開 staticSites は可 |
| C3 | Storage のリージョン | VNet/PE/Func を同一リージョンに揃える | ✅ **eastasia** | eastasia に統一 |
| C4 | VNet 統合対応プラン(Flex Consumption 等)が当該リージョンで利用可能か | バックエンド移設先の選定 | ⚠ 要確認 | eastasia の Flex 対応確認 |
| C5 | Microsoft.Network / PrivateDNS / Web / App プロバイダ登録済みか | PE/DNS/Func 作成可否 | ✅ 全て Registered | 作成可 |
| C6 | SWA プラン(Free/Standard) と linked backend 可否 | linked backend は Standard 必須 | ✅ **Standard** | linked backend 可 |
| C7 | サブスクリプション所有者/ネットワーク作成権限 | インフラ構築の実行主体 | ⚠ 要確認 | 所有者ローカル実行想定 |
| C8 | コスト許容(Func プラン/PE/VNet) | 予算 | ⚠ 要確認 | — |

> **C1 確認コマンド(所有者がローカルで `az login` 後に実行):**
> ```pwsh
> # storage に効いている強制系ポリシー割当を一覧
> $sid = az storage account show -n stclickthroughprod -g rg-clickthrough-prod --query id -o tsv
> az policy assignment list --scope $sid --disable-scope-strict-match -o table
> # 候補の定義IDから policyRule の対象リソース型/field を確認
> az policy definition show --name <policyDefinitionName> --query "policyRule.if" -o json
> # → Microsoft.Storage のみ = C1:No(案B-1) / Microsoft.Web も含む = C1:Yes(案B-2)
> ```

### VNet 統合と「公開」の関係(要点)
- **VNet 統合は OUTBOUND のみ**に作用する(Func → Private Storage へ到達するため)。
- **INBOUND(公開)は別設定** (`publicNetworkAccess` / アクセス制限)。
- したがって理屈上は「**公開 inbound + VNet outbound**」の Function App は作れる。
- ただし **C1 が真(=Web もポリシーで Disabled 強制)** の場合は公開口を持てないため、
  - 公開: Azure Front Door / Application Gateway、オリジンは Private Endpoint、
  - あるいは SWA(公開) → Private Endpoint 経由で linked backend(要 SWA Dedicated)
  という追加構成が必要になる。→ **C1 の確認が設計の分岐点**。

## 4. アーキテクチャ (確定: **案 B-1**)

C1=No が確定したため、公開 Function App をプロキシとして使う **B-1** を採用。

```
ブラウザ ─HTTPS─> SWA(公開/Standard) ─linked backend─> Function App(Flex, eastasia)
                                              ├ inbound : 公開(SWA からのみ許可)
                                              └ outbound: VNet統合 → Private Endpoint → Storage(Disabledのまま/ポリシー準拠)
動画は Function App で API プロキシ(Range対応)。ストレージアクセスは Managed Identity(allowSharedKeyAccess=false 準拠)。
```

補足(代替案): Storage を **NSP** に関連付ければ `StorageAccount_PublicNetwork_Modify` の対象外になり、
ペリメータ inbound ルールで制御できるが、不特定多数のブラウザ許可は不向きのため B-1 を優先。

## 5. タスク一覧 (進捗)

- [x] 原因特定 (Azure Policy による publicNetworkAccess=Disabled 強制)
- [x] NSP 未関連付けの確認
- [x] 配信経路(SAS直アクセス)の把握
- [x] 設計/進捗/教訓 MD 作成 (本ファイル)
- [ ] **C1〜C8 環境制約の確認 (進行中)**
- [ ] アーキテクチャ確定 (B-1 or B-2)
- [ ] コード: blobService ストリーム取得/アップロード
- [ ] コード: videos-get を Range 対応プロキシ化
- [ ] コード: videos-upload を API 経由に統一
- [ ] フロント: videoService を proxy URL へ差替
- [ ] ローカルビルド/型チェック
- [ ] 統合ブラウザ E2E テスト作成・実行
- [ ] インフラ構築スクリプト (VNet/PE/DNS/Func)
- [ ] CI/CD 更新 (linked backend デプロイ)
- [ ] 本番反映・検証

## 6. 教訓 (Lessons Learned)

- L1: GitHub Actions のスケジュールは1〜2.5時間遅延・スキップあり。単発 cron は単一障害点。
  → 営業時間中の毎時実行で自己回復させる。
- L2: `az storage account update --public-network-access Enabled` が **エラー無しで無視**される
  場合、Azure Policy(Modify効果)が inline で上書きしている。応答 JSON の値で必ず確認する。
- L3: `publicNetworkAccess=Disabled` では **IP許可も bypass=AzureServices も無効**。
  到達できるのは Private Endpoint と(NSP併用時の)perimeter ルールのみ。
- L4: `publicNetworkAccess=SecuredByPerimeter` かつ NSP 未関連付け = **全 inbound/outbound 拒否**。
  NSP を作成せずにこのモードにすると完全遮断される(要注意)。
- L5: NSP の Associate ダイアログに候補が出ない = **NSP リソース未作成**。先に NSP 本体を作る。
- L6: CI の SP は最小権限(Storage 書込のみ)。policy 読取/例外作成/network 作成は不可。
  ポリシー/ネットワーク操作は所有者アカウントのローカル実行が必要。
- L7: **VNet 統合は outbound のみ。公開可否は別問題(C1)**。設計はここを先に確定する。
- L8: 強制元は **Microsoft コーポレートテナントの MCAPSGov/SFI ポリシー**(`StorageAccount_PublicNetwork_Modify`)。
  Tenant Root MG 割当のため **自己例外不可**。方針 A はこの環境では不適。
- L9: MCAPSGov は **リソース型ごと**にポリシーが分かれている。Storage/Cosmos/KV/SQL は public 禁止だが
  **Microsoft.Web は対象外** → 公開 Function App をプロキシにできる(B-1 成立の根拠)。
- L10: `StorageAccount_PublicNetwork_Modify` は **“excluding NSP configured resources”**。
  NSP に載せれば Modify 強制から外れる(NSP 探索は正しい直感だった)。
- L11: 当テナントは **ARM 書込/削除に MFA 必須**(Conditional Access)。インフラ構築時は MFA ステップアップが必要。

## 7. 実行ログ

- 2026-07-10: 原因診断、NSP 未関連付け確認、enable ワークフロー改善(毎時+bypass)、
  本設計 MD 作成。
- 2026-07-10: 環境制約診断実行。確定: Storage=eastasia/Standard_LRS、
  プロバイダ(Network/Web/App)全て Registered、既存 Web は **SWA(Standard) のみ**、
  既存 Function App なし。linked backend 可(Standard)。残る不確定は **C1**。
- 2026-07-10: 所有者ログインでガバナンス確定。MCAPSGov/SFI の `StorageAccount_PublicNetwork_Modify` が原因と確定。
  **C1=No**(Web は対象外) → **アーキテクチャ B-1 に確定**。MFA 必須・モダンリソース作成は可を確認。
  次: コード(動画プロキシ化)実装に着手(Azure 不要・MFA不要の部分から)。
