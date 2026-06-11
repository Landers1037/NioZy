# NioZy Oh My Posh bootstrap: posh-git + oh-my-posh prompt (loaded before shell-integration.ps1)
if ($null -eq $Global:NioZyOhMyPoshBootstrapped) {
  $Global:NioZyOhMyPoshBootstrapped = $true

  if ($env:NIOZY_OMP_ENABLED -ne '1') { return }

  $poshGitModule = $env:NIOZY_POSH_GIT_MODULE
  if (-not [string]::IsNullOrWhiteSpace($poshGitModule) -and (Test-Path -LiteralPath $poshGitModule)) {
    try {
      Import-Module -Name $poshGitModule -Force -ErrorAction Stop
    } catch {}
  }

  $ompExe = $env:NIOZY_OMP_EXE
  if (-not [string]::IsNullOrWhiteSpace($ompExe) -and (Test-Path -LiteralPath $ompExe)) {
    $ompConfig = $env:NIOZY_OMP_CONFIG
    if ([string]::IsNullOrWhiteSpace($ompConfig) -or -not (Test-Path -LiteralPath $ompConfig)) {
      $ompConfig = $null
    }
    try {
      $initArgs = @('init', 'pwsh')
      if ($ompConfig) {
        $initArgs += @('--config', $ompConfig)
      }
      (& $ompExe @initArgs) | Invoke-Expression
    } catch {}
  }
}
