$ErrorActionPreference = 'Stop'
$projectDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$nodePath = (Get-Command node -ErrorAction Stop).Source
$taskName = 'GitHubRadar-Weekly-' + ([System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($projectDir))).Replace('-', '').Substring(0, 8))
if ((Get-TimeZone).Id -ne 'China Standard Time') { throw 'This installer expects Windows timezone China Standard Time (Beijing). Set the timezone or configure a Task Scheduler trigger manually.' }
$action = New-ScheduledTaskAction -Execute $nodePath -Argument ('--env-file-if-exists=.env "' + (Join-Path $projectDir 'server.mjs') + '" --scan') -WorkingDirectory $projectDir
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At '09:00'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 20) -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 15)
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Scan GitHub Trending every Monday at 09:00 Beijing time. Run missed schedules when available.' -Force | Out-Null
$dataPath = Join-Path $projectDir 'data'
New-Item -ItemType Directory -Path $dataPath -Force | Out-Null
$record = @{ name = $taskName; installedAt = [DateTime]::UtcNow.ToString('o'); timezone = 'Asia/Shanghai' } | ConvertTo-Json
[System.IO.File]::WriteAllText((Join-Path $dataPath 'windows-task.json'), $record, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Installed: $taskName. Every Monday 09:00 Beijing time; missed runs start when available."
Get-ScheduledTaskInfo -TaskName $taskName | Select-Object NextRunTime, LastTaskResult
