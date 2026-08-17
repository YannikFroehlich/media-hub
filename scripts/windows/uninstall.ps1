param(
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'MediaHub')
)

$ErrorActionPreference = 'Stop'
$resolvedRoot = [System.IO.Path]::GetFullPath($InstallRoot)
$expectedParent = [System.IO.Path]::GetFullPath($env:LOCALAPPDATA)
if (-not $resolvedRoot.StartsWith($expectedParent, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Das Installationsverzeichnis liegt außerhalb von LOCALAPPDATA und wird nicht entfernt.'
}

$pidFile = Join-Path $resolvedRoot 'media-hub.pid'
if (Test-Path -LiteralPath $pidFile) {
  $serverPid = [int](Get-Content -LiteralPath $pidFile -Raw)
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $serverPid" -ErrorAction SilentlyContinue
  if ($process -and $process.CommandLine -like '*server.mjs*') {
    Stop-Process -Id $serverPid -Force
  }
}

$shortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'Media Hub.lnk'
if (Test-Path -LiteralPath $shortcutPath) {
  Remove-Item -LiteralPath $shortcutPath -Force
}
if (Test-Path -LiteralPath $resolvedRoot) {
  Remove-Item -LiteralPath $resolvedRoot -Recurse -Force
}
Write-Host 'Media Hub wurde deinstalliert. Browser-Daten können separat in Chrome gelöscht werden.'
