# NioZy shell integration: report cwd via OSC 7 and VS Code 633
if ($null -eq $Global:NioZyShellIntegration) {
  $Global:NioZyShellIntegration = $true
  $Global:NioZyOriginalPrompt = $function:Prompt
  $Global:NioZyLocationEventSub = $null

  function Global:NioZyWriteCwdOsc() {
    if ($pwd.Provider.Name -ne 'FileSystem') { return }
    $path = $pwd.ProviderPath
    if ([string]::IsNullOrWhiteSpace($path)) { return }
    $pathForward = $path -replace '\\', '/'
    $esc = [char]27
    $bel = [char]7
    $escaped = $path -replace '\\x', '\x5cx' -replace ';', '\x3b'
    # Use Console.Out to ensure output reaches the PTY stream under ConPTY/PSHost
    [Console]::Out.Write("$esc]7;file://${env:COMPUTERNAME}/$pathForward$bel")
    [Console]::Out.Write("$esc]633;P;Cwd=$escaped$bel")
    try { [Console]::Out.Flush() } catch {}
  }

  # Emit once immediately (initial cwd), and also on every location change.
  try { NioZyWriteCwdOsc } catch {}
  try {
    if ($null -eq $Global:NioZyLocationEventSub) {
      $Global:NioZyLocationEventSub = Register-EngineEvent -SourceIdentifier PowerShell.OnLocationChanged -Action {
        # Action runs in a different scope; call via function: drive explicitly.
        try { & $function:NioZyWriteCwdOsc } catch {}
      }
    }
  } catch {
    # Some hosts may restrict engine events; Prompt hook below remains as fallback.
  }

  # Hook the location-changing commands so `cd`, `pushd`, `popd` always update immediately.
  try {
    function Global:Set-Location {
      param(
        [Parameter(Position = 0, ValueFromPipeline = $true, ValueFromPipelineByPropertyName = $true)]
        [object] $Path,
        [string] $LiteralPath,
        [switch] $PassThru,
        [string] $StackName
      )
      Microsoft.PowerShell.Management\Set-Location @PSBoundParameters | Out-Null
      try { NioZyWriteCwdOsc } catch {}
      if ($PassThru) { Get-Location }
    }
  } catch {}

  try {
    function Global:Push-Location {
      param(
        [Parameter(Position = 0, ValueFromPipeline = $true, ValueFromPipelineByPropertyName = $true)]
        [object] $Path,
        [string] $LiteralPath,
        [switch] $PassThru,
        [string] $StackName
      )
      Microsoft.PowerShell.Management\Push-Location @PSBoundParameters | Out-Null
      try { NioZyWriteCwdOsc } catch {}
      if ($PassThru) { Get-Location }
    }
  } catch {}

  try {
    function Global:Pop-Location {
      param(
        [switch] $PassThru,
        [string] $StackName
      )
      Microsoft.PowerShell.Management\Pop-Location @PSBoundParameters | Out-Null
      try { NioZyWriteCwdOsc } catch {}
      if ($PassThru) { Get-Location }
    }
  } catch {}

  function Global:Prompt() {
    try { NioZyWriteCwdOsc } catch {}
    return & $Global:NioZyOriginalPrompt
  }

  # 内置 niozy-cat（即使 PATH 未刷新也可通过函数调用）
  try {
    function Global:niozy-cat {
      param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
      $bin = $env:NIOZY_BIN
      if ([string]::IsNullOrWhiteSpace($bin)) {
        throw 'NIOZY_BIN is not set. Open a new NioZy terminal tab.'
      }
      $script = Join-Path $bin 'niozy-cat.mjs'
      if (-not (Test-Path -LiteralPath $script)) {
        throw "niozy-cat not found: $script"
      }
      & node $script @Args
    }
  } catch {}

  # niozy-cat：图片路径 Tab 补全
  try {
    $imagePattern = '*.{png,jpg,jpeg,gif,webp,bmp}'
    Register-ArgumentCompleter -CommandName niozy-cat -Native -ScriptBlock {
      param($wordToComplete, $commandAst, $cursorPosition)
      $padLength = $cursorPosition - $commandAst.Extent.StartOffset
      $line = $commandAst.ToString().PadRight($padLength, ' ').Substring(0, $padLength)
      if ($line -match 'niozy-cat\s+(-\w+\s+)*$') {
        Get-ChildItem -Path . -File -ErrorAction SilentlyContinue |
          Where-Object { $_.Extension -match '^\.(png|jpe?g|gif|webp|bmp)$' } |
          ForEach-Object { $_.Name } |
          Where-Object { $_ -like "$wordToComplete*" } |
          Sort-Object
        return
      }
      Get-ChildItem -Path . -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -match '^\.(png|jpe?g|gif|webp|bmp)$' } |
        ForEach-Object { $_.FullName } |
        Where-Object { $_ -like "$wordToComplete*" } |
        Sort-Object
    }
  } catch {}
}
