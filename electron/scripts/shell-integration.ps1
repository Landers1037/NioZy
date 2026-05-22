# NioZy shell integration: report cwd via OSC 7 and VS Code 633
if ($null -eq $Global:NioZyShellIntegration) {
  $Global:NioZyShellIntegration = $true
  $Global:NioZyOriginalPrompt = $function:Prompt

  function Global:Prompt() {
    if ($pwd.Provider.Name -eq 'FileSystem') {
      $path = $pwd.ProviderPath
      $pathForward = $path -replace '\\', '/'
      $esc = [char]27
      $bel = [char]7
      $escaped = $path -replace '\\x', '\x5cx' -replace ';', '\x3b'
      Write-Host -NoNewline "$esc]7;file://${env:COMPUTERNAME}/$pathForward$bel"
      Write-Host -NoNewline "$esc]633;P;Cwd=$escaped$bel"
    }
    return & $Global:NioZyOriginalPrompt
  }
}
