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
}
