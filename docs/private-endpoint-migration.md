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

| 項目 | 結果 | 根拠 |
|---|---|---|
| publicNetworkAccess | Disabled 強制(enable しても戻る) | CI 診断ログ |
| NSP 関連付け | 無し (`networkSecurityPerimeterConfigurations={value:[]}`) | CI 診断ログ |
| Private Endpoint | 無し | networkAcls 照会 |
| networkAcls | bypass=AzureServices, defaultAction=Allow, ipRules=219.104.137.230 | 照会 |
| SP 権限 | policy 読取/例外作成 **不可** | AuthorizationFailed |
| フロント配信 | ブラウザ→SAS URL 直アクセス | videoService.ts / blobService.ts |

## 3. 環境制約チェックリスト (実装前に確定させる)

> ⚠ これらが確定するまで実装のインフラ部分には入らない。

| # | 確認項目 | なぜ重要か | 状態 | 結論 |
|---|---|---|---|---|
| C1 | **Microsoft.Web(Functions/App Service) の publicNetworkAccess を Disabled 強制するポリシーがあるか** | 公開バックエンドを作れるかが決まる。あるなら Front Door/App GW 等の公開口が別途必要 | ⚠ 要所有者確認 | ポリシー定義の対象リソース型を読む(下記コマンド) |
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

## 4. アーキテクチャ決定木 (C1 の結果で分岐)

```
C1: Web も publicNetworkAccess=Disabled 強制？
├─ No (公開 Function App 可)  → 【案B-1: 推奨・最小】
│    ブラウザ → SWA(公開) → linked backend: Function App(Flex Consumption)
│                          ├ inbound: 公開(SWAからのみ許可)
│                          └ outbound: VNet統合 → Private Endpoint → Storage
│    + 動画は API プロキシ(Range対応)
│
└─ Yes (公開 Web も不可)      → 【案B-2: 重い】
     公開口: Azure Front Door / App Gateway (WAF)
       → Private Endpoint → Function App(private inbound) → VNet → Storage PE
     + 動画は API プロキシ
```

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

## 7. 実行ログ

- 2026-07-10: 原因診断、NSP 未関連付け確認、enable ワークフロー改善(毎時+bypass)、
  本設計 MD 作成。
- 2026-07-10: 環境制約診断実行。確定: Storage=eastasia/Standard_LRS、
  プロバイダ(Network/Web/App)全て Registered、既存 Web は **SWA(Standard) のみ**、
  既存 Function App なし。linked backend 可(Standard)。残る不確定は **C1**。
  次: C1 を所有者ローカルで確定 → アーキテクチャ(B-1/B-2)確定 → コード実装へ。
