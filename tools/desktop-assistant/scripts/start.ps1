param([switch]$CreateShortcutOnly,[switch]$UpdateDesktopShortcut)
$ErrorActionPreference = 'Stop'
$toolDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
& node (Join-Path $PSScriptRoot 'run.mjs') ready
if ($LASTEXITCODE -ne 0) { throw 'Desktop Assistant setup or build failed. See the output above.' }
$appDir = Join-Path $toolDir '.runtime\app'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $appDir 'scripts\start.ps1') -CreateShortcutOnly
if ($LASTEXITCODE -ne 0) { throw 'Could not create the native shortcut.' }
$package = Get-Content -LiteralPath (Join-Path $appDir 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$shortcutPath = Join-Path $toolDir ($package.build.productName + '.lnk')
Copy-Item -LiteralPath (Join-Path $appDir 'DesktopAssistant.lnk') -Destination $shortcutPath -Force
$shell = New-Object -ComObject WScript.Shell
if ($UpdateDesktopShortcut) {
  $desktopPath = Join-Path ([Environment]::GetFolderPath('Desktop')) ($package.build.productName + '.lnk')
  if (Test-Path -LiteralPath $desktopPath) {
    $existing = $shell.CreateShortcut($desktopPath)
    if (-not $existing.TargetPath.StartsWith($toolDir + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'An unrelated desktop shortcut was preserved.' }
  }
  Copy-Item -LiteralPath $shortcutPath -Destination $desktopPath -Force
}
if (-not $CreateShortcutOnly) { (New-Object -ComObject Shell.Application).ShellExecute($shortcutPath,'',$appDir,'open',1) }
