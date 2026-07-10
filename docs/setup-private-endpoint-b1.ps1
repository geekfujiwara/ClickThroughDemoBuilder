<#
.SYNOPSIS
  ClickThrough B-1 インフラ構築: Storage Private Endpoint + VNet統合 Function App + SWA linked backend。

.DESCRIPTION
  会社ポリシー(MCAPSGov/SFI: StorageAccount_PublicNetwork_Modify)により
  stclickthroughprod は publicNetworkAccess=Disabled が強制される。Private Link は
  当該ポリシーの影響を受けないため、Private Endpoint 経由で Function App(VNet統合)から
  ストレージへ到達し、動画は Function App が API プロキシする。

  既存インフラを再利用:
    - VNet vnetclickthrough (japaneast, 10.0.0.0/16, subnet 'default' に SWA用PE)
    追加 (すべて japaneast — VNet統合は Func とサブネットが同一リージョン必須):
    - subnet snet-pe   10.0.1.0/24 … Private Endpoints
    - subnet snet-func 10.0.2.0/24 … Function App VNet統合(委任)
    - Private DNS zone privatelink.blob.core.windows.net (+VNetリンク)
    - Private Endpoint: stclickthroughprod (blob, クロスリージョンPE)
    - バックエンド用ストレージ(japaneast) + blob PE
    - Function App (Flex Consumption, Node20, System MI, VNet統合)
    - RBAC: Function MI → Storage Blob Data Contributor
    - SWA linked backend

  ⚠ ARM 書込に MFA 必須。Auth_Helper が自動で MFA セッションを確保する。
    -Stage で段階実行 (1..8 / all)。
#>
param(
  [ValidateSet('1','2','3','4','5','6','7','8','all')]
  [string]$Stage = 'all',
  [string]$ResourceGroup = 'rg-clickthrough-prod',
  [string]$Location      = 'japaneast',
  [string]$DataStorage   = 'stclickthroughprod',
  [string]$SwaName       = 'swa-clickthrough-prod',
  [string]$VnetName      = 'vnetclickthrough',
  [string]$PeSubnet      = 'snet-pe',
  [string]$FuncSubnet    = 'snet-func',
  [string]$FuncStorage   = 'stclickthroughfunc',
  [string]$FuncApp       = 'func-clickthrough-prod',
  [string]$DnsZone       = 'privatelink.blob.core.windows.net'
)

$ErrorActionPreference = 'Stop'
# PowerShell 7.3+: ネイティブコマンド(az)の非0終了で停止させる
try { $PSNativeCommandUseErrorActionPreference = $true } catch {}

# MFA セッションを確保
. "$PSScriptRoot/Auth_Helper.ps1"
Assert-AzMfa

function Section($n, $t) { Write-Host "`n===== [Stage $n] $t =====" -ForegroundColor Cyan }
function Ok($m) { Write-Host "  ✓ $m" -ForegroundColor Green }
function Info($m){ Write-Host "  … $m" -ForegroundColor Yellow }
# NOTE: 関数引数は $Stage と大文字小文字で衝突しないよう $target を使う
function Should([string]$target) { return ($Stage -eq 'all' -or $Stage -eq $target) }

$sub = az account show --query id -o tsv
$dataStorageId = az storage account show -n $DataStorage -g $ResourceGroup --query id -o tsv
Write-Host "Subscription: $sub" -ForegroundColor DarkGray
Write-Host "Data storage: $dataStorageId" -ForegroundColor DarkGray

# ── Stage 1: サブネット追加 (既存VNet再利用) ──────────────────
if (Should '1') {
  Section 1 "サブネット追加 ($VnetName)"
  az network vnet subnet create -g $ResourceGroup --vnet-name $VnetName -n $PeSubnet `
    --address-prefixes 10.0.1.0/24 -o none
  az network vnet subnet update -g $ResourceGroup --vnet-name $VnetName -n $PeSubnet `
    --private-endpoint-network-policies Disabled -o none
  Ok "$PeSubnet (PEポリシー無効)"
  az network vnet subnet create -g $ResourceGroup --vnet-name $VnetName -n $FuncSubnet `
    --address-prefixes 10.0.2.0/24 --delegations Microsoft.App/environments -o none
  Ok "$FuncSubnet (委任 Microsoft.App/environments)"
}

# ── Stage 2: Private DNS zone + link ──────────────────────────
if (Should '2') {
  Section 2 'Private DNS zone (blob) + VNet link'
  az network private-dns zone create -g $ResourceGroup -n $DnsZone -o none
  Ok "zone $DnsZone"
  az network private-dns link vnet create -g $ResourceGroup -z $DnsZone `
    -n link-blob -v $VnetName -e false -o none
  Ok 'VNet link'
}

# ── Stage 3: Private Endpoint for data storage (blob) ─────────
if (Should '3') {
  Section 3 "Private Endpoint → $DataStorage (blob, クロスリージョン)"
  az network private-endpoint create -g $ResourceGroup -n pe-$DataStorage -l $Location `
    --vnet-name $VnetName --subnet $PeSubnet `
    --private-connection-resource-id $dataStorageId `
    --group-id blob --connection-name conn-$DataStorage -o none
  Ok 'PE 作成'
  az network private-endpoint dns-zone-group create -g $ResourceGroup `
    --endpoint-name pe-$DataStorage -n zg-blob `
    --private-dns-zone $DnsZone --zone-name blob -o none
  Ok 'DNS zone group (A レコード自動登録)'
}

# ── Stage 4: Backend storage (Function runtime) + blob PE ─────
if (Should '4') {
  Section 4 'Function ランタイム用ストレージ + blob PE'
  az storage account create -n $FuncStorage -g $ResourceGroup -l $Location `
    --sku Standard_LRS --kind StorageV2 --allow-blob-public-access false -o none
  Ok "storage $FuncStorage"
  $funcStorageId = az storage account show -n $FuncStorage -g $ResourceGroup --query id -o tsv
  az network private-endpoint create -g $ResourceGroup -n pe-$FuncStorage-blob -l $Location `
    --vnet-name $VnetName --subnet $PeSubnet `
    --private-connection-resource-id $funcStorageId `
    --group-id blob --connection-name conn-$FuncStorage-blob -o none
  az network private-endpoint dns-zone-group create -g $ResourceGroup `
    --endpoint-name pe-$FuncStorage-blob -n zg-blob --private-dns-zone $DnsZone --zone-name blob -o none
  Ok 'backend storage blob PE + DNS'
}

# ── Stage 5: Flex Consumption Function App + VNet統合 ─────────
if (Should '5') {
  Section 5 'Flex Consumption Function App'
  # バックエンドストレージが private のため、作成時に VNet 統合を指定する必要がある
  az functionapp create -n $FuncApp -g $ResourceGroup `
    --storage-account $FuncStorage `
    --flexconsumption-location $Location `
    --runtime node --runtime-version 20 `
    --vnet $VnetName --subnet $FuncSubnet -o none
  Ok "Function App $FuncApp (VNet統合込み作成)"
  az functionapp identity assign -n $FuncApp -g $ResourceGroup -o none
  Ok 'System-assigned MI'
}

# ── Stage 6: RBAC ─────────────────────────────────────────────
if (Should '6') {
  Section 6 'RBAC (Function MI → Storage Blob Data Contributor)'
  $principalId = az functionapp identity show -n $FuncApp -g $ResourceGroup --query principalId -o tsv
  if (-not $principalId) { throw 'Function App の principalId が取得できません (Stage 5 未完?)' }
  $funcStorageId = az storage account show -n $FuncStorage -g $ResourceGroup --query id -o tsv
  foreach ($scope in @($dataStorageId, $funcStorageId)) {
    az role assignment create --assignee-object-id $principalId --assignee-principal-type ServicePrincipal `
      --role 'Storage Blob Data Contributor' --scope $scope -o none
  }
  Ok "RBAC 付与 (principal $principalId)"
}

# ── Stage 7: App settings ─────────────────────────────────────
if (Should '7') {
  Section 7 'App settings'
  az functionapp config appsettings set -n $FuncApp -g $ResourceGroup --settings `
    "STORAGE_ACCOUNT_NAME=$DataStorage" "AzureWebJobsStorage__accountName=$FuncStorage" -o none
  az functionapp config appsettings delete -n $FuncApp -g $ResourceGroup --setting-names AzureWebJobsStorage -o none 2>$null
  Ok 'STORAGE_ACCOUNT_NAME / AzureWebJobsStorage(MI化) 設定'
  Info 'AUTH/GUEST/AppInsights 等は SWA から手動コピー:'
  Info "  az staticwebapp appsettings list -n $SwaName -g $ResourceGroup"
}

# ── Stage 8: SWA linked backend ───────────────────────────────
if (Should '8') {
  Section 8 'SWA linked backend'
  $funcId = az functionapp show -n $FuncApp -g $ResourceGroup --query id -o tsv
  az staticwebapp backends link -n $SwaName -g $ResourceGroup `
    --backend-resource-id $funcId --backend-region $Location -o none
  Ok "linked backend 接続 (/api を $FuncApp へ委譲)"
}

Write-Host "`n完了。次: Function コードを api/ からデプロイし、E2E を再実行。" -ForegroundColor Green
