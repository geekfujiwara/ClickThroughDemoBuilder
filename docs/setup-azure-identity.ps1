<#
.SYNOPSIS
  ClickThrough Demo Builder -- Azure 本番環境 Managed Identity セットアップスクリプト

.DESCRIPTION
  Azure Static Web Apps (Managed Functions) の構成。
  会社ポリシーによって以下が強制される環境に対応:
    - allowSharedKeyAccess: false  (接続文字列/AccountKey による Blob アクセス禁止)
    - publicNetworkAccess: Disabled (夜間に自動で Disabled に戻される)

  この設定でも動作させるための要件:
    1. SWA の Managed Identity に Blob Storage の RBAC ロールを付与
    2. ストレージの networkAcls.bypass=AzureServices を設定
       publicNetworkAccess=Disabled でも「信頼済み Azure サービス」経由でアクセス可能
    3. SWA アプリ設定に STORAGE_ACCOUNT_NAME を設定 (接続文字列は不要)

  なぜこれで解決するか:
    Azure Functions は「信頼済み Azure サービス」に分類される。
    bypass=AzureServices が設定されていれば、publicNetworkAccess=Disabled でも
    Managed Identity を使用した内部ネットワーク経由でストレージにアクセスできる。
    会社ポリシーが publicNetworkAccess を Disabled に戻しても bypass 設定は維持され、
    アプリは引き続き動作する (ポリシーが bypass も上書きする場合は Private Endpoint が必要)。

.NOTES
  実行前に: az login ; az account set --subscription YOUR_SUBSCRIPTION_ID
#>

#region ===== 設定値 (環境に合わせて変更) =====

$SUBSCRIPTION_ID   = "<YOUR_SUBSCRIPTION_ID>"
$RESOURCE_GROUP    = "<YOUR_RESOURCE_GROUP>"
$SWA_NAME          = "<YOUR_SWA_NAME>"
$DATA_STORAGE_NAME = "<YOUR_APP_DATA_STORAGE_ACCOUNT>"

#endregion

#region ===== 前提確認 =====

Write-Host "[1/5] サブスクリプションを設定中..." -ForegroundColor Cyan
az account set --subscription $SUBSCRIPTION_ID
if ($LASTEXITCODE -ne 0) { throw "サブスクリプション設定失敗。az login 済みか確認してください。" }

#endregion

#region ===== SWA Managed Identity の取得 =====

Write-Host "[2/5] Static Web App の Managed Identity を取得中..." -ForegroundColor Cyan
$principalId = az staticwebapp show --name $SWA_NAME --resource-group $RESOURCE_GROUP --query "identity.principalId" -o tsv

if (-not $principalId) {
  Write-Host "  Managed Identity を有効化します..." -ForegroundColor Yellow
  az staticwebapp identity assign --name $SWA_NAME --resource-group $RESOURCE_GROUP --identities "[system]"
  $principalId = az staticwebapp show --name $SWA_NAME --resource-group $RESOURCE_GROUP --query "identity.principalId" -o tsv
}
Write-Host "  Principal ID: $principalId" -ForegroundColor Green

#endregion

#region ===== RBAC ロール付与 =====

Write-Host "[3/5] Storage Blob Data Contributor ロールを付与中..." -ForegroundColor Cyan
$dataScope = "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Storage/storageAccounts/$DATA_STORAGE_NAME"

az role assignment create --assignee-object-id $principalId --assignee-principal-type ServicePrincipal --role "Storage Blob Data Contributor" --scope $dataScope
if ($LASTEXITCODE -eq 0) {
  Write-Host "  Storage Blob Data Contributor 付与完了" -ForegroundColor Green
} else {
  Write-Host "  警告: 付与失敗 (すでに付与済みの場合は無視してください)" -ForegroundColor Yellow
}

#endregion

#region ===== Storage ネットワーク設定 =====

Write-Host "[4/5] bypass=AzureServices を設定中..." -ForegroundColor Cyan
Write-Host "  publicNetworkAccess=Disabled でも Azure Functions はストレージにアクセスできます" -ForegroundColor Yellow

az storage account update --name $DATA_STORAGE_NAME --resource-group $RESOURCE_GROUP --bypass AzureServices --default-action Deny
if ($LASTEXITCODE -eq 0) {
  Write-Host "  bypass=AzureServices, defaultAction=Deny に設定完了" -ForegroundColor Green
} else {
  Write-Host "  エラー: ネットワーク設定の更新に失敗しました" -ForegroundColor Red
}

#endregion

#region ===== SWA アプリ設定 =====

Write-Host "[5/5] STORAGE_ACCOUNT_NAME をアプリ設定に追加中..." -ForegroundColor Cyan
az staticwebapp appsettings set --name $SWA_NAME --resource-group $RESOURCE_GROUP --setting-names "STORAGE_ACCOUNT_NAME=$DATA_STORAGE_NAME"
if ($LASTEXITCODE -eq 0) {
  Write-Host "  STORAGE_ACCOUNT_NAME=$DATA_STORAGE_NAME を設定完了" -ForegroundColor Green
} else {
  Write-Host "  警告: Azure Portal から手動で STORAGE_ACCOUNT_NAME を設定してください" -ForegroundColor Yellow
}

#endregion

#region ===== 設定確認 =====

Write-Host "`n===== 設定確認 =====" -ForegroundColor Cyan

Write-Host "--- ストレージ ネットワーク設定 ---"
az storage account show --name $DATA_STORAGE_NAME --resource-group $RESOURCE_GROUP --query "{name:name,bypass:networkRuleSet.bypass,defaultAction:networkRuleSet.defaultAction,publicAccess:publicNetworkAccess}" -o table

Write-Host "--- RBAC ロール割り当て ---"
az role assignment list --assignee $principalId --scope $dataScope --query "[].{role:roleDefinitionName}" -o table

Write-Host "======================================" -ForegroundColor Green
Write-Host " セットアップ完了!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host "bypass=AzureServices + Managed Identity により:" -ForegroundColor Yellow
Write-Host "  会社ポリシーが publicNetworkAccess=Disabled に戻しても Functions はストレージにアクセスできます。" -ForegroundColor Yellow
Write-Host "  接続文字列 (AccountKey) は不要です (allowSharedKeyAccess=false でも動作)。" -ForegroundColor Yellow

#endregion
