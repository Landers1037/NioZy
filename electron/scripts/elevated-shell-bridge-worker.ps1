<#
  elevated-shell-bridge-worker.ps1
  Elevated side: launched via UAC by the bridge script.
  Connects to the named pipe, starts the target shell with redirected I/O,
  and relays bytes bidirectionally between the pipe and the child process.
#>
param(
    [Parameter(Mandatory)][string]$PipeName,
    [Parameter(Mandatory)][string]$TargetFile,
    [string]$TargetArgsBase64 = '',
    [string]$WorkingDirectory
)

$ErrorActionPreference = 'Stop'

if (-not $WorkingDirectory) { $WorkingDirectory = $env:USERPROFILE }

$targetArgsList = @()
if ($TargetArgsBase64) {
    try {
        $json = [System.Text.Encoding]::UTF8.GetString(
            [System.Convert]::FromBase64String($TargetArgsBase64)
        )
        $parsed = $json | ConvertFrom-Json
        if ($parsed -is [System.Array]) {
            $targetArgsList = @($parsed)
        } elseif ($parsed) {
            $targetArgsList = @($parsed)
        }
    } catch {}
}

$targetArgsStr = ($targetArgsList | ForEach-Object {
    $s = [string]$_
    if ($s -match '[\s"]') { "`"$($s -replace '"','\"')`"" } else { $s }
}) -join ' '

# xterm / node-pty 使用 UTF-8；重定向后的 cmd/PowerShell 原生程序在中文 Windows 上通常输出系统 ANSI（如 GBK 936）
$childEncoding = [System.Text.Encoding]::Default
$pipeEncoding = New-Object System.Text.UTF8Encoding $false

$pipe = $null
$proc = $null

try {
    $pipe = New-Object System.IO.Pipes.NamedPipeClientStream(
        '.',
        $PipeName,
        [System.IO.Pipes.PipeDirection]::InOut,
        [System.IO.Pipes.PipeOptions]::Asynchronous
    )
    $pipe.Connect(15000)

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $TargetFile
    if ($targetArgsStr) { $psi.Arguments = $targetArgsStr }
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput  = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $psi.CreateNoWindow = $true

    $proc = [System.Diagnostics.Process]::Start($psi)

    $writeLock = New-Object object

    # --- Runspace 1: stdout -> pipe ---
    $rs1 = [runspacefactory]::CreateRunspace()
    $rs1.Open()
    $ps1 = [powershell]::Create()
    $ps1.Runspace = $rs1
    [void]$ps1.AddScript({
        param($process, $pipeStream, $lock, $fromEnc, $toEnc)
        $buf = New-Object byte[] 4096
        try {
            while (-not $process.HasExited) {
                $n = $process.StandardOutput.BaseStream.Read($buf, 0, $buf.Length)
                if ($n -le 0) { break }
                $text = $fromEnc.GetString($buf, 0, $n)
                $out = $toEnc.GetBytes($text)
                [System.Threading.Monitor]::Enter($lock)
                try {
                    $pipeStream.Write($out, 0, $out.Length)
                    $pipeStream.Flush()
                } finally {
                    [System.Threading.Monitor]::Exit($lock)
                }
            }
        } catch {}
    }).AddArgument($proc).AddArgument($pipe).AddArgument($writeLock).AddArgument($childEncoding).AddArgument($pipeEncoding)
    $h1 = $ps1.BeginInvoke()

    # --- Runspace 2: stderr -> pipe ---
    $rs2 = [runspacefactory]::CreateRunspace()
    $rs2.Open()
    $ps2 = [powershell]::Create()
    $ps2.Runspace = $rs2
    [void]$ps2.AddScript({
        param($process, $pipeStream, $lock, $fromEnc, $toEnc)
        $buf = New-Object byte[] 4096
        try {
            while (-not $process.HasExited) {
                $n = $process.StandardError.BaseStream.Read($buf, 0, $buf.Length)
                if ($n -le 0) { break }
                $text = $fromEnc.GetString($buf, 0, $n)
                $out = $toEnc.GetBytes($text)
                [System.Threading.Monitor]::Enter($lock)
                try {
                    $pipeStream.Write($out, 0, $out.Length)
                    $pipeStream.Flush()
                } finally {
                    [System.Threading.Monitor]::Exit($lock)
                }
            }
        } catch {}
    }).AddArgument($proc).AddArgument($pipe).AddArgument($writeLock).AddArgument($childEncoding).AddArgument($pipeEncoding)
    $h2 = $ps2.BeginInvoke()

    # --- Runspace 3: pipe -> stdin ---
    $rs3 = [runspacefactory]::CreateRunspace()
    $rs3.Open()
    $ps3 = [powershell]::Create()
    $ps3.Runspace = $rs3
    [void]$ps3.AddScript({
        param($process, $pipeStream, $fromEnc, $toEnc)
        $buf = New-Object byte[] 4096
        try {
            while (-not $process.HasExited) {
                $n = $pipeStream.Read($buf, 0, $buf.Length)
                if ($n -le 0) { break }
                $text = $fromEnc.GetString($buf, 0, $n)
                $in = $toEnc.GetBytes($text)
                $process.StandardInput.BaseStream.Write($in, 0, $in.Length)
                $process.StandardInput.BaseStream.Flush()
            }
        } catch {}
        finally {
            try { $process.StandardInput.Close() } catch {}
        }
    }).AddArgument($proc).AddArgument($pipe).AddArgument($pipeEncoding).AddArgument($childEncoding)
    $h3 = $ps3.BeginInvoke()

    $proc.WaitForExit()

    Start-Sleep -Milliseconds 500
    try { $ps1.EndInvoke($h1) } catch {}
    try { $ps2.EndInvoke($h2) } catch {}

    $exitMsg = $pipeEncoding.GetBytes(
        "`r`n[Process exited with code $($proc.ExitCode)]`r`n"
    )
    [System.Threading.Monitor]::Enter($writeLock)
    try {
        $pipe.Write($exitMsg, 0, $exitMsg.Length)
        $pipe.Flush()
    } finally {
        [System.Threading.Monitor]::Exit($writeLock)
    }

    Start-Sleep -Milliseconds 300

} catch {
    if ($pipe -and $pipe.IsConnected) {
        try {
            $errMsg = $pipeEncoding.GetBytes("`r`n[Error: $_]`r`n")
            $pipe.Write($errMsg, 0, $errMsg.Length)
            $pipe.Flush()
        } catch {}
    }
} finally {
    try { if ($proc -and -not $proc.HasExited) { $proc.Kill() } } catch {}
    try { $pipe.Dispose() } catch {}
    try { $ps1.Dispose(); $rs1.Dispose() } catch {}
    try { $ps2.Dispose(); $rs2.Dispose() } catch {}
    try { $ps3.Dispose(); $rs3.Dispose() } catch {}
}
