<#
.SYNOPSIS
  Azure CLI の MFA 認証済みセッションを確保するヘルパー (書込操作に必須)。

.DESCRIPTION
  当テナント(MCAPSGov)は ARM の書込/削除に MFA を必須とする Conditional Access /
  Azure Policy が有効。通常の `az login` は SSO でキャッシュされたセッションを再利用し、
  MFA クレーム(amr=mfa)を持たないトークンになるため書込が RequestDisallowedByAzure で拒否される。

  このヘルパーは:
    1. 現在の management スコープのアクセストークンをデコードし amr に MFA があるか判定。
    2. MFA 済みなら何もしない (キャッシュ再利用)。
    3. 未 MFA なら claims-challenge(p1) を付与して MFA を強制する `az login` を実行。

  他スクリプトの先頭で dot-source して使う:
    . "$PSScriptRoot/Auth_Helper.ps1"
    Assert-AzMfa

.EXAMPLE
  . ./docs/Auth_Helper.ps1
  Assert-AzMfa            # MFA 済みセッションを保証 (必要時のみ再ログイン)
#>

$script:MgmtScope = 'https://management.core.windows.net//.default'
# {"access_token":{"acrs":{"essential":true,"values":["p1"]}}} を base64url 化したもの
$script:P1Challenge = 'eyJhY2Nlc3NfdG9rZW4iOnsiYWNycyI6eyJlc3NlbnRpYWwiOnRydWUsInZhbHVlcyI6WyJwMSJdfX19'

function Test-AzMfa {
  <# 現在のトークンが MFA 済みなら $true #>
  try {
    $tok = az account get-access-token --scope $script:MgmtScope --query accessToken -o tsv 2>$null
    if (-not $tok) { return $false }
    $parts = $tok.Split('.')
    if ($parts.Count -lt 2) { return $false }
    $p = $parts[1].Replace('-', '+').Replace('_', '/')
    switch ($p.Length % 4) { 2 { $p += '==' } 3 { $p += '=' } }
    $json = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p)) | ConvertFrom-Json
    $amr = @($json.amr)
    return ($amr -contains 'mfa' -or $amr -contains 'rsa' -or $amr -contains 'ngcmfa' -or $amr -contains 'fido')
  } catch {
    return $false
  }
}

function Assert-AzMfa {
  <#
    MFA 済みセッションを保証する。
    - 既に MFA 済み(amr に mfa 等) → 無言でキャッシュ再利用(ダイアログを出さない)。
    - MFA 未認証(amr=pwd) → 既定ではダイアログを出さず、明確な案内を出して停止。
      -Interactive 指定時のみ MFA 強制ログインのダイアログを出す。
  #>
  param([switch]$Interactive)

  if (Test-AzMfa) {
    $u = az account show --query "user.name" -o tsv 2>$null
    Write-Host "✓ MFA 済みトークンをキャッシュ再利用 ($u)" -ForegroundColor Green
    return
  }

  if (-not $Interactive) {
    throw @'
現在のログインは MFA 未認証 (amr=pwd) です。Azure の書込には MFA が必須です。
対処:
  1) アカウントに MFA が未登録の場合は https://aka.ms/mfasetup で登録。
  2) 登録後、MFA を実際に完了してログイン:
       . ./docs/Auth_Helper.ps1 ; Assert-AzMfa -Interactive
  (ログイン時に認証アプリ等の MFA を必ず実施してください。pwd のみでは書込は通りません。)
'@
  }

  Write-Host "… MFA 強制ログインを行います (ブラウザで MFA を必ず完了してください)..." -ForegroundColor Yellow
  az login --scope $script:MgmtScope --claims-challenge $script:P1Challenge --only-show-errors -o none
  if (-not (Test-AzMfa)) {
    throw 'MFA トークンを取得できませんでした。アカウントに MFA が登録されていない可能性があります (https://aka.ms/mfasetup)。'
  }
  $u = az account show --query "user.name" -o tsv 2>$null
  Write-Host "✓ MFA ログイン完了 ($u)" -ForegroundColor Green
}
