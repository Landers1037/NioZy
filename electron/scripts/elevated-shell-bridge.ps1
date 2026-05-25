<#
  elevated-shell-bridge.ps1
  Non-elevated side: runs inside node-pty.
  Creates a named-pipe server, launches the worker script elevated via UAC,
  then relays I/O between the pty (stdin/stdout) and the pipe.
#>
param(
    [Parameter(Mandatory)][string]$TargetFile,
    [string]$TargetArgsBase64 = '',
    [string]$WorkingDirectory
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8

if (-not $WorkingDirectory) { $WorkingDirectory = $PWD.Path }

$workerPath = Join-Path $PSScriptRoot 'elevated-shell-bridge-worker.ps1'
if (-not (Test-Path -LiteralPath $workerPath)) {
    Write-Host "`r`n[Error] Worker script not found: $workerPath" -ForegroundColor Red
    exit 1
}

$pipeName = "NioZy_Elev_$([guid]::NewGuid().ToString('N').Substring(0,16))"

$server = New-Object System.IO.Pipes.NamedPipeServerStream(
    $pipeName,
    [System.IO.Pipes.PipeDirection]::InOut,
    1,
    [System.IO.Pipes.PipeTransmissionMode]::Byte,
    [System.IO.Pipes.PipeOptions]::Asynchronous
)

$elevArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$workerPath`" -PipeName `"$pipeName`" -TargetFile `"$TargetFile`" -TargetArgsBase64 `"$TargetArgsBase64`" -WorkingDirectory `"$WorkingDirectory`""

try {
    Start-Process powershell.exe -ArgumentList $elevArgs -Verb RunAs -WindowStyle Hidden
} catch {
    $server.Dispose()
    Write-Host "`r`n[Error] UAC elevation cancelled or failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Requesting administrator privileges..." -ForegroundColor DarkGray

try {
    $connectResult = $server.BeginWaitForConnection($null, $null)
    if (-not $connectResult.AsyncWaitHandle.WaitOne(30000)) {
        $server.Dispose()
        Write-Host "`r`n[Error] Elevated process did not connect within 30 seconds." -ForegroundColor Red
        exit 1
    }
    $server.EndWaitForConnection($connectResult)
} catch {
    $server.Dispose()
    Write-Host "`r`n[Error] Pipe connection failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Elevated shell connected.`r`n" -ForegroundColor Green

$outStream = [Console]::OpenStandardOutput()
$inStream  = [Console]::OpenStandardInput()

# --- Background runspace: pipe -> pty stdout ---
$rsPool = [runspacefactory]::CreateRunspace()
$rsPool.Open()

$psReader = [powershell]::Create()
$psReader.Runspace = $rsPool
[void]$psReader.AddScript({
    param($pipeStream, $stdOut, $stdIn)
    $buf = New-Object byte[] 8192
    try {
        while ($pipeStream.IsConnected) {
            $n = $pipeStream.Read($buf, 0, $buf.Length)
            if ($n -le 0) { break }
            $stdOut.Write($buf, 0, $n)
            $stdOut.Flush()
        }
    } catch {}
    finally {
        try { $stdIn.Close() } catch {}
    }
}).AddArgument($server).AddArgument($outStream).AddArgument($inStream)

$readerHandle = $psReader.BeginInvoke()

# --- Main thread: pty stdin -> pipe ---
$writerBuf = New-Object byte[] 8192
try {
    while ($server.IsConnected) {
        $n = $inStream.Read($writerBuf, 0, $writerBuf.Length)
        if ($n -le 0) { break }
        $server.Write($writerBuf, 0, $n)
        $server.Flush()
    }
} catch {}

try { $psReader.EndInvoke($readerHandle) } catch {}
$psReader.Dispose()
$rsPool.Dispose()
$server.Dispose()
