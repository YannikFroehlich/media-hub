param(
  [int]$Port = 4173,
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'MediaHub')
)

$ErrorActionPreference = 'Stop'
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$nodeMajor = [int]((& node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -ne 24) {
  throw "Media Hub benötigt Node.js 24 LTS. Gefunden wurde Node.js $nodeMajor."
}

Push-Location $projectRoot
try {
  npm ci
  if ($LASTEXITCODE -ne 0) { throw 'npm ci ist fehlgeschlagen.' }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Der Production-Build ist fehlgeschlagen.' }
} finally {
  Pop-Location
}

$webTarget = Join-Path $InstallRoot 'app'
New-Item -ItemType Directory -Force -Path $webTarget | Out-Null
Copy-Item -Path (Join-Path $projectRoot 'dist\media-hub\browser\*') -Destination $webTarget -Recurse -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'server.mjs') -Destination (Join-Path $InstallRoot 'server.mjs') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'start-media-hub.ps1') -Destination (Join-Path $InstallRoot 'start-media-hub.ps1') -Force

$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupFolder 'Media Hub.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = 'powershell.exe'
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$(Join-Path $InstallRoot 'start-media-hub.ps1')`" -Port $Port -InstallRoot `"$InstallRoot`""
$shortcut.WorkingDirectory = $InstallRoot
$shortcut.Description = 'Media Hub starten'
$shortcut.Save()

& (Join-Path $InstallRoot 'start-media-hub.ps1') -Port $Port -InstallRoot $InstallRoot
Write-Host "Media Hub wurde installiert. Der lokale Server startet künftig automatisch."
Write-Host "Adresse: http://127.0.0.1:$Port"
