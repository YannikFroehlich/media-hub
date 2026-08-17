param(
  [int]$Port = 4173,
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'MediaHub')
)

$ErrorActionPreference = 'Stop'
$healthUrl = "http://127.0.0.1:$Port/health"
$alreadyRunning = $false

try {
  $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
  $alreadyRunning = $health.app -eq 'media-hub' -and $health.status -eq 'ok'
} catch {
  $alreadyRunning = $false
}

if (-not $alreadyRunning) {
  $serverPath = Join-Path $InstallRoot 'server.mjs'
  $webRoot = Join-Path $InstallRoot 'app'
  if (-not (Test-Path -LiteralPath $serverPath) -or -not (Test-Path -LiteralPath $webRoot)) {
    throw "Die Media-Hub-Installation ist unvollständig. Bitte install.ps1 erneut ausführen."
  }

  Start-Process -FilePath 'node.exe' `
    -ArgumentList @($serverPath, $webRoot, $Port) `
    -WorkingDirectory $InstallRoot `
    -WindowStyle Hidden

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 250
    try {
      $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1
      if ($health.app -eq 'media-hub') {
        $ready = $true
        break
      }
    } catch {
      # The local server is still starting.
    }
  }
  if (-not $ready) {
    throw "Media Hub konnte Port $Port nicht starten. Möglicherweise ist der Port bereits belegt."
  }
}
