# セキュアな Web サイト × ストレージ構成 (テナントガバナンス準拠)

> **目的**: 組織のセキュリティポリシー（例: `publicNetworkAccess=Disabled` と共有キー認証禁止を強制）
> の下でも、**ブラウザからストレージ上のコンテンツ（動画・画像・ファイル等）を安全に配信**できる
> リファレンスアーキテクチャと構築手順。ストレージは**非公開のまま**、コンピュートが Private Link
> 経由でアクセスし、コンテンツは API プロキシ経由でブラウザへ中継する。
>
> 本ドキュメントは特定プロジェクトから一般化・秘匿化したもの。プレースホルダ `<...>` は環境値に置換する。

---

## 1. 適用シナリオ / 前提となる制約

以下のような**組織ガバナンス（Azure Policy / Conditional Access）**が敷かれた環境を対象とする。

| 制約 | 典型的なポリシー | 影響 |
|---|---|---|
| ストレージの公衆ネットワークアクセス禁止 | `publicNetworkAccess=Disabled` を Modify 効果で強制 | ブラウザ・外部からの直接アクセス不可 |
| 共有キー認証禁止 | `allowSharedKeyAccess=false` を強制 | 接続文字列 / AccountKey / キーベース SAS が使用不可 → **Entra ID (Managed Identity) 認証必須** |
| 匿名 Blob アクセス禁止 | `allowBlobPublicAccess=false` | 匿名公開コンテナ不可 |
| ARM 書込に MFA 必須 | Resource write/delete に MFA を要求 | 構築操作前に MFA 認証が必要 |
| リージョン制限 | 許可リージョンのポリシー | 新規リソースは許可リージョンに作成 |

> これらは自己例外(exemption)できない**組織統制**である場合が多い。**ポリシーと戦わず、準拠する構成**を採る。

### 重要な前提: Private Link はネットワークポリシーの影響を受けない
`publicNetworkAccess=Disabled` でも **Private Endpoint 経由のアクセスは常に成功**する。
Network Security Perimeter (NSP) を使う組織でも Private Link は対象外。これが本アーキテクチャの土台。

---

## 2. 設計判断ツリー (実装前に確定させる)

```
Q1. データ用ストレージは publicNetworkAccess=Disabled が強制されるか？
   └ Yes → Private Endpoint 必須 (本アーキテクチャ)

Q2. コンピュート(App Service/Functions 等 Microsoft.Web)も publicNetworkAccess=Disabled 強制か？
   ├ No  → 【案 A: 推奨・最小】公開フロント + 公開バックエンド(VNet統合) + Private Endpoint
   └ Yes → 【案 B: 追加防御】公開口は Front Door / App Gateway(WAF) → Private Endpoint →
            非公開バックエンド → VNet → ストレージ PE

Q3. ブラウザがストレージコンテンツを直接取得する設計か？
   └ Yes → 直接アクセスは Private 化で不可能になる → 【必須】コンテンツを API プロキシ経由に変更
```

> **Q2 の確認方法**: 強制元ポリシー定義の対象リソース型を確認する。
> ストレージ限定なら Web は公開可(案 A)。Web も対象なら案 B。

---

## 3. リファレンスアーキテクチャ (案 A)

```
[ブラウザ] ──HTTPS──> [公開フロント(静的サイト/CDN)]
                           │ /api/* を linked backend へ委譲
                           ▼
                    [バックエンド API (Functions/App Service)]
                       ├ inbound : 公開 (フロントからのみ許可推奨)
                       ├ 認証     : Managed Identity (共有キー不使用)
                       └ outbound: VNet 統合 ──> [Private Endpoint] ──> [データ用ストレージ(Disabled)]
                       └ コンテンツ配信: API プロキシ (HTTP Range 対応) でブラウザへ中継
```

**キーポイント**
- ストレージは `publicNetworkAccess=Disabled` の**まま**（ポリシー準拠）。
- コンピュートは **VNet 統合(outbound)** で Private Endpoint に到達。VNet 統合は outbound のみ、公開可否は別設定。
- ブラウザは**ストレージに直接触れない**。全コンテンツは API がストリーム中継する。
- Blob 認証は **Managed Identity + RBAC**（`Storage Blob Data Contributor` 等）。SAS/接続文字列は使わない。

---

## 4. 事前確認チェックリスト (Sure にしてから着手)

| # | 確認項目 | 目的 |
|---|---|---|
| C1 | データストレージのリージョン / SKU | VNet/PE/コンピュートを同一(または近接)リージョンに揃える |
| C2 | コンピュート(Microsoft.Web) の公開可否ポリシー | 案 A / 案 B の分岐 |
| C3 | 必要リソースプロバイダ登録 (`Microsoft.Network` / `Microsoft.Web` / `Microsoft.App`) | 作成可否 |
| C4 | VNet 統合対応プランの当該リージョン可用性 | バックエンド選定 |
| C5 | フロントの linked backend 対応可否 (プラン要件) | 委譲構成 |
| C6 | ARM 書込の MFA / リージョン制限ポリシー | 構築時の認証・配置 |
| C7 | リソース作成権限 (所有者 / 貢献者) | 構築主体 |

---

## 5. 構築手順 (案 A / CLI)

> すべて `<REGION>`（データストレージと同一リージョン。VNet 統合はコンピュートとサブネットが**同一リージョン必須**）で作成する。
> **VNet 統合の制約上、コンピュートは VNet と同一リージョンに置くこと。** PE はクロスリージョン可。

### 5.0 前提: MFA 認証済みセッションを確保
組織が ARM 書込に MFA を要求する場合、**MFA を実施したトークン**が必要。
`az login` で実際に MFA を完了し、トークンの `amr` に `mfa`/`rsa` 等が含まれることを確認する（`amr=pwd` は未 MFA）。

### 5.1 VNet + サブネット
```bash
# 既存 VNet があれば再利用。無ければ作成。
az network vnet create -g <RG> -n <VNET> -l <REGION> --address-prefixes 10.0.0.0/16 \
  --subnet-name <PE_SUBNET> --subnet-prefixes 10.0.1.0/24
# Private Endpoint 用サブネット: network policies 無効化
az network vnet subnet update -g <RG> --vnet-name <VNET> -n <PE_SUBNET> \
  --private-endpoint-network-policies Disabled
# コンピュート VNet 統合用サブネット (委任)
az network vnet subnet create -g <RG> --vnet-name <VNET> -n <FUNC_SUBNET> \
  --address-prefixes 10.0.2.0/24 --delegations Microsoft.App/environments
```

### 5.2 Private DNS ゾーン + VNet リンク
```bash
az network private-dns zone create -g <RG> -n privatelink.blob.core.windows.net
az network private-dns link vnet create -g <RG> -z privatelink.blob.core.windows.net \
  -n <LINK_NAME> -v <VNET> -e false
```

### 5.3 データストレージへの Private Endpoint
```bash
DATA_ID=$(az storage account show -n <DATA_STORAGE> -g <RG> --query id -o tsv)
az network private-endpoint create -g <RG> -n pe-<DATA_STORAGE> -l <REGION> \
  --vnet-name <VNET> --subnet <PE_SUBNET> \
  --private-connection-resource-id "$DATA_ID" --group-id blob --connection-name conn-data
az network private-endpoint dns-zone-group create -g <RG> \
  --endpoint-name pe-<DATA_STORAGE> -n zg-blob \
  --private-dns-zone privatelink.blob.core.windows.net --zone-name blob
```

### 5.4 バックエンド用ストレージ + Private Endpoint (Functions を使う場合)
Functions は稼働用ストレージを必要とし、それも同ポリシーで Disabled 化される。**PE を付与**する。
```bash
az storage account create -n <FUNC_STORAGE> -g <RG> -l <REGION> \
  --sku Standard_LRS --kind StorageV2 --allow-blob-public-access false
FUNC_ID=$(az storage account show -n <FUNC_STORAGE> -g <RG> --query id -o tsv)
az network private-endpoint create -g <RG> -n pe-<FUNC_STORAGE>-blob -l <REGION> \
  --vnet-name <VNET> --subnet <PE_SUBNET> \
  --private-connection-resource-id "$FUNC_ID" --group-id blob --connection-name conn-func-blob
az network private-endpoint dns-zone-group create -g <RG> \
  --endpoint-name pe-<FUNC_STORAGE>-blob -n zg-blob \
  --private-dns-zone privatelink.blob.core.windows.net --zone-name blob
```

### 5.5 バックエンド(例: Functions Flex Consumption) を作成
> **必須**: 共有キー禁止環境では、deployment ストレージ認証を**作成時に** Managed Identity にする。
> 作成後の変更はデプロイ層(Kudu)に反映されにくく `Key based authentication is not permitted` で失敗する。
```bash
az functionapp create -n <FUNCTION_APP> -g <RG> \
  --storage-account <FUNC_STORAGE> \
  --flexconsumption-location <REGION> \
  --runtime node --runtime-version 20 \
  --vnet <VNET> --subnet <FUNC_SUBNET> \
  --deployment-storage-auth-type SystemAssignedIdentity \
  --assign-identity '[system]'
```

### 5.6 RBAC (Managed Identity にデータ/バックエンドストレージへの権限)
```bash
MI=$(az functionapp identity show -n <FUNCTION_APP> -g <RG> --query principalId -o tsv)
for S in "$DATA_ID" "$FUNC_ID"; do
  az role assignment create --assignee-object-id "$MI" --assignee-principal-type ServicePrincipal \
    --role "Storage Blob Data Contributor" --scope "$S"
done
```

### 5.7 アプリ設定 (シークレットは env / Key Vault 参照で)
```bash
az functionapp config appsettings set -n <FUNCTION_APP> -g <RG> --settings \
  "STORAGE_ACCOUNT_NAME=<DATA_STORAGE>" \
  "AzureWebJobsStorage__accountName=<FUNC_STORAGE>"   # 稼働ストレージも MI 認証
# 認証系シークレットは Key Vault 参照を推奨:
#   "JWT_SECRET=@Microsoft.KeyVault(SecretUri=https://<KV>.vault.azure.net/secrets/JWT-SECRET)"
```

### 5.8 フロントに linked backend を接続
```bash
FUNC_RES=$(az functionapp show -n <FUNCTION_APP> -g <RG> --query id -o tsv)
az staticwebapp backends link -n <FRONTEND> -g <RG> \
  --backend-resource-id "$FUNC_RES" --backend-region <REGION>
```

---

## 6. デプロイ (重要な落とし穴)

- **企業ネットワークからの大容量 zip デプロイはリセットされることがある** → **CI(GitHub Actions 等)からデプロイ**する。
- **Flex Consumption + 共有キー禁止**では、deployment ストレージ認証が Managed Identity であること（5.5）が前提。
  キーベースだと `Key based authentication is not permitted` で失敗する。
- CI ではフロントとバックエンドを分離してデプロイ（フロント=静的サイトデプロイ、API=Functions デプロイ）。

---

## 7. アプリケーションコードのパターン (コンテンツプロキシ)

ブラウザがストレージへ直接アクセスできないため、**API がコンテンツをストリーム中継**する。

- **配信**: `GET /api/content/{id}/stream` — Blob を Managed Identity で読み取り、**HTTP Range 対応**で返す
  (シーク・大容量ファイル対応)。`206 Partial Content` + `Content-Range` を返す。
- **アップロード**: SAS 直 PUT を廃止し、**API 経由バイナリアップロード**に統一。
- **認証情報の取得**: 接続文字列/AccountKey/キーベース SAS は使わない。
  `DefaultAzureCredential` / `ManagedIdentityCredential` で Blob クライアントを生成。
- **ユーザー委任 SAS が必要な場合**: `getUserDelegationKey`(Entra ベース) を使う。ただし
  ブラウザ直アクセスは Private 化で不可のため、基本はプロキシ配信にする。

擬似コード (Node / TypeScript):
```ts
// Range 対応ストリーム取得
const props = await blob.getProperties();
const total = props.contentLength;
const { start, end } = parseRange(req.headers.range, total); // 無ければ全体
const dl = await blob.download(start, end - start + 1);
return {
  status: range ? 206 : 200,
  headers: {
    'Content-Type': props.contentType,
    'Content-Length': String(end - start + 1),
    'Accept-Ranges': 'bytes',
    ...(range && { 'Content-Range': `bytes ${start}-${end}/${total}` }),
  },
  body: Readable.toWeb(dl.readableStreamBody),
};
```

---

## 8. 検証手順

1. バックエンド単体: 未認証で保護エンドポイントが `401` を返す（配信済み・認証保護の確認）。
2. フロント経由: `/api/*` が linked backend に委譲され `401`（ルーティング確認）。
3. 認証後のデータ取得: 一覧/詳細等が `200` でデータを返す（**Private Endpoint 経由の Blob 読取成功**）。
4. コンテンツ配信: Range 要求に `206 Partial Content` + 正しい `Content-Range` を返す。
5. E2E(ブラウザ自動化): ログイン→コンテンツ表示までを自動テスト化。

---

## 9. セキュリティのベストプラクティス

- **共有キー / 接続文字列を使わない**。Managed Identity + RBAC のみ。
- **シークレットはコードに置かない**。環境変数 / GitHub Secrets / **Key Vault 参照**で管理。
- リポジトリでは一時ファイル・診断ダンプ・認証キャッシュを **`.gitignore`**（`.azure/`, `*.publishsettings`,
  `tmp_*`, `*_dump.json`, デプロイ zip 等）。
- バックエンドの inbound はフロント経由のみに絞る（アクセス制限）。
- ストレージは `publicNetworkAccess=Disabled` を**維持**（public への切替自動化を作らない）。
- 露出したシークレットは**ローテーション**する。

---

## 10. 教訓 / 落とし穴 (一般化)

- L1: `--public-network-access Enabled` が**エラー無しで無視**される場合、Modify ポリシーが inline 上書きしている。応答値で確認。
- L2: `publicNetworkAccess=Disabled` では IP 許可も trusted services バイパスも無効。到達は Private Endpoint のみ。
- L3: `SecuredByPerimeter` かつ NSP 未関連付け = 全 inbound/outbound 拒否。NSP 未作成のままこのモードにしない。
- L4: 強制ポリシーは**リソース型ごと**に定義されることが多い。ストレージ限定なら Web は公開可(案 A)。
- L5: VNet 統合は **outbound のみ**。公開可否は別問題。設計はここを先に確定。
- L6: **ARM 書込に MFA 必須**な環境では `amr=pwd`(未 MFA) だと `RequestDisallowedByAzure`。実際に MFA を完了する。
- L7: **Flex Consumption + 共有キー禁止**は deployment 認証を**作成時に** Managed Identity 指定（後付け不可）。
- L8: 企業網からの大容量 zip デプロイはリセットされる → CI から実施。
- L9: 動画等の `net::ERR_ABORTED` は video 要素の Range 再要求による正常挙動。サーバは 206 を返せていれば OK。

---

## 11. クリーンアップ (旧「公開切替」自動化の撤去)

Private Endpoint 化後は、ストレージを定期的に公開/非公開へ切り替える自動化（Automation runbook /
スケジュール / CI ワークフロー）は**不要かつ無効**（ポリシーが Disabled を強制するため public 化は無視される）。
混乱防止のため**削除**する。

---

## 付録: プレースホルダ一覧

| プレースホルダ | 意味 |
|---|---|
| `<RG>` | リソースグループ |
| `<REGION>` | リージョン (データストレージと統一) |
| `<VNET>` / `<PE_SUBNET>` / `<FUNC_SUBNET>` | 仮想ネットワーク / PE 用 / コンピュート統合用サブネット |
| `<DATA_STORAGE>` / `<FUNC_STORAGE>` | データ用 / バックエンド稼働用ストレージ |
| `<FUNCTION_APP>` | バックエンド (Functions 等) |
| `<FRONTEND>` | 公開フロント (静的サイト等) |
| `<KV>` | Key Vault |
