param(
  [Parameter(Mandatory = $true)]
  [string]$ExecutablePath,
  [int]$Port = 42731,
  [int]$TimeoutSeconds = 45
)

$ErrorActionPreference = 'Stop'
$resolvedExecutable = (Resolve-Path -LiteralPath $ExecutablePath).Path
$previousPort = $env:MEDIA_HUB_PORT
$previousSmokeTest = $env:MEDIA_HUB_SMOKE_TEST
$mediaHubProcess = $null

try {
  $env:MEDIA_HUB_PORT = [string]$Port
  $env:MEDIA_HUB_SMOKE_TEST = '1'
  $mediaHubProcess = Start-Process `
    -FilePath $resolvedExecutable `
    -ArgumentList '--disable-gpu' `
    -WindowStyle Hidden `
    -PassThru

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $healthy = $false
  while ((Get-Date) -lt $deadline) {
    if ($mediaHubProcess.HasExited) {
      throw "Packaged application exited before its health endpoint became available."
    }

    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
      if ($health.status -eq 'ok' -and $health.app -eq 'media-hub') {
        $healthy = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }

  if (-not $healthy) {
    throw "Packaged application did not become healthy within $TimeoutSeconds seconds."
  }

  if (-not $mediaHubProcess.WaitForExit(15000)) {
    throw 'Packaged application did not exit after completing smoke-test mode.'
  }
  if ($mediaHubProcess.ExitCode -ne 0) {
    throw "Packaged application exited with code $($mediaHubProcess.ExitCode)."
  }

  Write-Output "Packaged Media Hub passed its startup smoke test on port $Port."
} finally {
  if ($null -ne $mediaHubProcess -and -not $mediaHubProcess.HasExited) {
    Stop-Process -Id $mediaHubProcess.Id -Force
  }

  if ($null -eq $previousPort) {
    Remove-Item Env:MEDIA_HUB_PORT -ErrorAction SilentlyContinue
  } else {
    $env:MEDIA_HUB_PORT = $previousPort
  }
  if ($null -eq $previousSmokeTest) {
    Remove-Item Env:MEDIA_HUB_SMOKE_TEST -ErrorAction SilentlyContinue
  } else {
    $env:MEDIA_HUB_SMOKE_TEST = $previousSmokeTest
  }
}
