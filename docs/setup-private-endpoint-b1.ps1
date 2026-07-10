<#
.SYNOPSIS
  ClickThrough B-1 インフラ構築: Storage Private Endpoint + VNet統合 Function App + SWA linked backend。

.DESCRIPTION
  会社ポリシー(MCAPSGov/SFI: StorageAccount_PublicNetwork_Modify)により
  stclickthroughprod は publicNetworkAccess=Disabled が強制される。
  Private Link は当該ポリシー/NSP の影響を受けないため、Private Endpoint 経由で
  Function App(VNet統合)からストレージへ到達し、動画は Function App が API プロキシする。

  構成 (すべて eastasia):
    - VNet vnet-clickthrough (10.30.0.0/16)
        snet-pe   10.30.1.0/24  … Private Endpoints
        snet-func 10.30.2.0/24  … Function App VNet統合(委任)
    - Private DNS zone privatelink.blob.core.windows.net (+VNetリンク)
    - Private Endpoint: 既存データ用 stclickthroughprod (blob)
    - バックエンド用ストレージ (Function ランタイム) + その Private Endpoint
    - Function App (Flex Consumption, Node20, System MI, VNet統合)
    - RBAC: Function MI → Storage Blob Data Contributor (両ストレージ)
    - SWA linked backend で /api を Function App へ委譲

  ⚠ 前提:
    - 当テナントは ARM 書込に MFA 必須。事前に `az login`(MFA完了)しておくこと。
    - モダンリソース作成は許可されている(Deny は Classic のみ)。
    - -Stage で段階実行可能(MCAPSGov ポリシーでの失敗を切り分けるため推奨)。

.PARAMETER Stage
  実行するステージ番号 (1..8)。'all' で全ステージ。既定は 'all'。

.EXAMPLE
  az login    # MFA 完了
  ./docs/setup-private-endpoint-b1.ps1 -Stage 1
  ./docs/setup-private-endpoint-b1.ps1 -Stage 2
  ...
  ./docs/setup-private-endpoint-b1.ps1 -Stage all
#>
param(
  [ValidateSet('1','2','3','4','5','6','7','8','all')]
  [string]$Stage = 'all',
  [string]$ResourceGroup = 'rg-clickthrough-prod',
  [string]$Location      = 'eastasia',
  [string]$DataStorage   = 'stclickthroughprod',
  [string]$SwaName       = 'swa-clickthrough-prod',
  [string]$VnetName      = 'vnet-clickthrough',
  [string]$FuncStorage   = 'stclickthroughfunc',
  [string]$FuncApp       = 'func-clickthrough-prod',
  [string]$DnsZone       = 'privatelink.blob.core.windows.net'
)

$ErrorActionPreference = 'Stop'
function Section($n, $t) { Write-Host "`n===== [Stage $n] $t =====" -ForegroundColor Cyan }
function Ok($m)  { Write-Host "  ✓ $m" -ForegroundColor Green }
function Info($m){ Write-Host "  … $m" -ForegroundColor Yellow }
function Run($stage) { return ($Stage -eq 'all' -or $Stage -eq "$stage") }

$sub = az account show --query id -o tsv
$dataStorageId = az storage account show -n $DataStorage -g $ResourceGroup --query id -o tsv
Write-Host "Subscription: $sub" -ForegroundColor DarkGray
Write-Host "Data storage: $dataStorageId" -ForegroundColor DarkGray

# ── Stage 1: VNet + subnets ───────────────────────────────────
if (Run 1) {
  Section 1 'VNet + subnets'
  az network vnet create -g $ResourceGroup -n $VnetName -l $Location `
    --address-prefixes 10.30.0.0/16 --subnet-name snet-pe --subnet-prefixes 10.30.1.0/24 -o none
  Ok "VNet $VnetName / snet-pe"
  az network vnet subnet create -g $ResourceGroup --vnet-name $VnetName -n snet-func `
    --address-prefixes 10.30.2.0/24 `
    --delegations Microsoft.App/environments -o none
  # PE サブネットは network policies を無効化
  az network vnet subnet update -g $ResourceGroup --vnet-name $VnetName -n snet-pe `
    --private-endpoint-network-policies Disabled -o none
  Ok "snet-func(委任) / snet-pe(PEポリシー無効)"
}

# ── Stage 2: Private DNS zone + link ──────────────────────────
if (Run 2) {
  Section 2 'Private DNS zone + VNet link'
  az network private-dns zone create -g $ResourceGroup -n $DnsZone -o none 2>$null
  Ok "zone $DnsZone"
  az network private-dns link vnet create -g $ResourceGroup -z $DnsZone `
    -n link-clickthrough -v $VnetName -e false -o none 2>$null
  Ok "VNet link"
}

# ── Stage 3: Private Endpoint for data storage (blob) ─────────
if (Run 3) {
  Section 3 "Private Endpoint → $DataStorage (blob)"
  az network private-endpoint create -g $ResourceGroup -n pe-$DataStorage -l $Location `
    --vnet-name $VnetName --subnet snet-pe `
    --private-connection-resource-id $dataStorageId `
    --group-id blob --connection-name conn-$DataStorage -o none
  Ok "PE 作成"
  az network private-endpoint dns-zone-group create -g $ResourceGroup `
    --endpoint-name pe-$DataStorage -n zg-blob `
    --private-dns-zone $DnsZone --zone-name blob -o none
  Ok "DNS zone group (A レコード自動登録)"
}

# ── Stage 4: Backend storage (Function runtime) + PE ──────────
if (Run 4) {
  Section 4 "Function ランタイム用ストレージ + PE"
  az storage account create -n $FuncStorage -g $ResourceGroup -l $Location `
    --sku Standard_LRS --kind StorageV2 --allow-blob-public-access false -o none
  Ok "storage $FuncStorage"
  $funcStorageId = az storage account show -n $FuncStorage -g $ResourceGroup --query id -o tsv
  # ポリシーで publicNetworkAccess=Disabled 化される前提。blob/queue/table/file の PE を作成。
  foreach ($grp in @('blob','queue','table','file')) {
    az network private-endpoint create -g $ResourceGroup -n pe-$FuncStorage-$grp -l $Location `
      --vnet-name $VnetName --subnet snet-pe `
      --private-connection-resource-id $funcStorageId `
      --group-id $grp --connection-name conn-$FuncStorage-$grp -o none
    $zone = "privatelink.$grp.core.windows.net"
    az network private-dns zone create -g $ResourceGroup -n $zone -o none 2>$null
    az network private-dns link vnet create -g $ResourceGroup -z $zone -n link-$grp -v $VnetName -e false -o none 2>$null
    az network private-endpoint dns-zone-group create -g $ResourceGroup `
      --endpoint-name pe-$FuncStorage-$grp -n zg-$grp --private-dns-zone $zone --zone-name $grp -o none
    Ok "PE+DNS $grp"
  }
}

# ── Stage 5: Flex Consumption Function App + VNet統合 ─────────
if (Run 5) {
  Section 5 'Flex Consumption Function App'
  az functionapp create -n $FuncApp -g $ResourceGroup `
    --storage-account $FuncStorage `
    --flexconsumption-location $Location `
    --runtime node --runtime-version 20 `
    --functions-version 4 -o none
  Ok "Function App $FuncApp"
  az functionapp identity assign -n $FuncApp -g $ResourceGroup -o none
  Ok "System-assigned MI"
  # VNet 統合 (outbound)
  az functionapp vnet-integration add -n $FuncApp -g $ResourceGroup `
    --vnet $VnetName --subnet snet-func -o none
  Ok "VNet 統合"
  # ランタイムストレージを MI 認証に (共有キー禁止ポリシー対応)
  az functionapp config appsettings set -n $FuncApp -g $ResourceGroup --settings `
    "AzureWebJobsStorage__accountName=$FuncStorage" -o none
  az functionapp config appsettings delete -n $FuncApp -g $ResourceGroup --setting-names AzureWebJobsStorage -o none 2>$null
  Ok "AzureWebJobsStorage を MI 化"
}

# ── Stage 6: RBAC ─────────────────────────────────────────────
if (Run 6) {
  Section 6 'RBAC (Function MI → Storage Blob Data Contributor)'
  $principalId = az functionapp identity show -n $FuncApp -g $ResourceGroup --query principalId -o tsv
  $funcStorageId = az storage account show -n $FuncStorage -g $ResourceGroup --query id -o tsv
  foreach ($scope in @($dataStorageId, $funcStorageId)) {
    az role assignment create --assignee-object-id $principalId --assignee-principal-type ServicePrincipal `
      --role "Storage Blob Data Contributor" --scope $scope -o none
  }
  # Function ランタイムは queue/table も使うため owner 相当を backend storage に
  az role assignment create --assignee-object-id $principalId --assignee-principal-type ServicePrincipal `
    --role "Storage Queue Data Contributor" --scope $funcStorageId -o none 2>$null
  az role assignment create --assignee-object-id $principalId --assignee-principal-type ServicePrincipal `
    --role "Storage Account Contributor" --scope $funcStorageId -o none 2>$null
  Ok "RBAC 付与 (principal $principalId)"
}

# ── Stage 7: App settings (auth/guest を SWA からコピー) ──────
if (Run 7) {
  Section 7 'App settings'
  az functionapp config appsettings set -n $FuncApp -g $ResourceGroup --settings `
    "STORAGE_ACCOUNT_NAME=$DataStorage" -o none
  Info "AUTH/GUEST/AppInsights 等は SWA 設定を手動確認の上コピーしてください:"
  Info "  az staticwebapp appsettings list -n $SwaName -g $ResourceGroup"
  Ok "STORAGE_ACCOUNT_NAME 設定"
}

# ── Stage 8: SWA linked backend ───────────────────────────────
if (Run 8) {
  Section 8 'SWA linked backend'
  $funcId = az functionapp show -n $FuncApp -g $ResourceGroup --query id -o tsv
  az staticwebapp backends link -n $SwaName -g $ResourceGroup `
    --backend-resource-id $funcId --backend-region $Location -o none
  Ok "linked backend 接続 (/api を $FuncApp へ委譲)"
}

Write-Host "`n完了。次: Function コードを api/ からデプロイ (func azure functionapp publish $FuncApp) し、E2E を再実行。" -ForegroundColor Green
