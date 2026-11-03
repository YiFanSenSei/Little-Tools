$ErrorActionPreference = 'Stop'
$projectDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$recordPath = Join-Path $projectDir 'data\windows-task.json'
if (Test-Path -LiteralPath $recordPath) {
  $record = Get-Content -LiteralPath $recordPath -Raw -Encoding UTF8 | ConvertFrom-Json
  Unregister-ScheduledTask -TaskName $record.name -Confirm:$false
  Remove-Item -LiteralPath $recordPath
  Write-Host 'Weekly task removed.'
}
