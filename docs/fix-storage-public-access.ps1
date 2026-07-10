<#
.SYNOPSIS
  stclickthroughprod ストレージの publicNetworkAccess=Disabled を強制している
  Azure Policy を特定し、例外(exemption)を作成して Enabled を復元するスクリプト。

.DESCRIPTION
  GitHub Actions の SP はポリシー読取/例外作成の権限を持たないため、
  この操作は「サブスクリプション所有者(Owner / Resource Policy Contributor)」の
  アカウントでローカルから実行する必要があります。

  前提:
    - 診断で確認済み: この Storage は Network Security Perimeter(NSP) 未関連付け、
      Private Endpoint 無し、publicNetworkAccess は Azure Policy により Disabled 強制。

  ⚠ 重要な注意:
    publicNetworkAccess=Disabled は「セキュリティ統制」です。これが会社(組織/管理グループ)
    のガバナンスポリシーである場合、自己判断での例外作成はセキュリティ要件違反になる恐れが
    あります。実行前に必ず所属のセキュリティ/クラウド基盤チームに承認を得てください。
    恒久かつ安全な解決は Private Endpoint 化(B)です。

.PARAMETER Apply
  指定すると、特定したポリシー割り当てに対して例外を作成し、publicNetworkAccess=Enabled を
  再設定します。未指定(既定)では診断のみ行います。

.PARAMETER PolicyAssignmentId
  例外対象のポリシー割り当てID を明示指定する場合に使用(診断出力からコピー)。

.EXAMPLE
  # 1) まずログイン (この Storage を保有するテナント/サブスクリプション)
  az login
  # 2) 診断のみ (どのポリシーが強制しているか特定)
  ./docs/fix-storage-public-access.ps1
  # 3) 承認後、例外作成 + Enabled 復元
  ./docs/fix-storage-public-access.ps1 -Apply
#>
param(
  [string]$StorageName        = 'stclickthroughprod',
  [string]$ResourceGroup      = 'rg-clickthrough-prod',
  [string]$PolicyAssignmentId = '',
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'

function Assert-LoggedIn {
  try { az account show -o none 2>$null } catch { }
  if ($LASTEXITCODE -ne 0) {
    throw "az にログインしていません。`az login` で対象テナントにログインしてから再実行してください。"
  }
}

Write-Host "[1/5] ログイン確認..." -ForegroundColor Cyan
Assert-LoggedIn

Write-Host "[2/5] ストレージ解決..." -ForegroundColor Cyan
$storageId = az storage account show --name $StorageName --resource-group $ResourceGroup --query id -o tsv 2>$null
if (-not $storageId) {
  throw "ストレージ $StorageName ($ResourceGroup) が現在のサブスクリプションに見つかりません。`az account set --subscription <ID>` で正しいサブスクリプションに切り替えてください。"
}
Write-Host "  Storage: $storageId" -ForegroundColor Green

$pna = az storage account show --name $StorageName --resource-group $ResourceGroup --query publicNetworkAccess -o tsv
Write-Host "  現在の publicNetworkAccess: $pna" -ForegroundColor Yellow

Write-Host "[3/5] この Storage に効いているポリシー割り当てを列挙..." -ForegroundColor Cyan
$assignmentsJson = az policy assignment list --scope $storageId --disable-scope-strict-match `
  --query "[].{name:name, displayName:displayName, id:id, policyDefinitionId:policyDefinitionId, enforcementMode:enforcementMode}" -o json
$assignments = $assignmentsJson | ConvertFrom-Json
$assignments | Format-Table displayName, enforcementMode, id -AutoSize

Write-Host "[4/5] publicNetworkAccess 関連の候補を抽出..." -ForegroundColor Cyan
# 定義名/表示名に network/public を含むものを候補とする
$candidates = @()
foreach ($a in $assignments) {
  $defName = ($a.policyDefinitionId -split '/')[-1]
  $hay = "$($a.displayName) $defName"
  if ($hay -match '(?i)public.?network|network.?access|publicNetworkAccess|disable.*public') {
    $candidates += $a
  }
}
if (-not $candidates -and $PolicyAssignmentId) {
  $candidates = $assignments | Where-Object { $_.id -eq $PolicyAssignmentId }
}
if ($candidates) {
  Write-Host "  候補となるポリシー割り当て:" -ForegroundColor Green
  $candidates | Format-Table displayName, id -AutoSize
} else {
  Write-Host "  自動抽出できませんでした。上の一覧から publicNetworkAccess を強制している割り当てを特定し、" -ForegroundColor Yellow
  Write-Host "  -PolicyAssignmentId '<ID>' -Apply で再実行してください。" -ForegroundColor Yellow
}

if (-not $Apply) {
  Write-Host "`n診断のみ完了 (例外作成・Enabled 復元はしていません)。" -ForegroundColor Cyan
  Write-Host "承認取得後、-Apply を付けて再実行してください。" -ForegroundColor Cyan
  return
}

# ---- Apply: 例外作成 + Enabled 復元 ----
$target = if ($PolicyAssignmentId) {
  $PolicyAssignmentId
} elseif ($candidates.Count -eq 1) {
  $candidates[0].id
} else {
  throw "対象ポリシー割り当てを一意に特定できません。-PolicyAssignmentId '<ID>' を指定してください。候補: $($candidates.id -join '; ')"
}

Write-Host "[5/5] 例外を作成: $target" -ForegroundColor Cyan
az policy exemption create `
  --name "clickthrough-storage-pna-waiver" `
  --display-name "ClickThrough storage publicNetworkAccess waiver" `
  --description "ClickThrough Demo Builder はブラウザ直接アクセス(SAS)が必須のため public network access を許可(要セキュリティ承認)" `
  --exemption-category "Waiver" `
  --policy-assignment $target `
  --scope $storageId
if ($LASTEXITCODE -ne 0) {
  throw "例外作成に失敗しました。Microsoft.Authorization/policyExemptions/write 権限(Owner/Resource Policy Contributor)が必要です。"
}

Write-Host "  publicNetworkAccess=Enabled / defaultAction=Allow を再設定..." -ForegroundColor Cyan
az storage account update --name $StorageName --resource-group $ResourceGroup `
  --public-network-access Enabled --default-action Allow -o none

Start-Sleep -Seconds 5
$after = az storage account show --name $StorageName --resource-group $ResourceGroup `
  --query "{publicNetworkAccess:publicNetworkAccess, defaultAction:networkRuleSet.defaultAction, bypass:networkRuleSet.bypass}" -o json
Write-Host "`n===== 適用後 =====" -ForegroundColor Green
Write-Host $after
Write-Host "publicNetworkAccess が Enabled になっていれば成功です。Disabled のままなら、"
Write-Host "ポリシーが例外を無視している(スコープ違い/別ポリシー)可能性があるため、上の一覧を再確認してください。"
