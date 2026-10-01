$ErrorActionPreference = 'Stop'
$backupScript = Join-Path $PSScriptRoot 'run-backup.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $backupScript + '"')
$trigger = New-ScheduledTaskTrigger -Daily -At '23:55'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew
$existing = Get-ScheduledTask -TaskName 'BevShopDailyBackup' -ErrorAction SilentlyContinue
if ($existing -and $existing.Actions.Arguments -ne $action.Arguments) { throw 'A different task already uses BevShopDailyBackup; it was not changed.' }
Register-ScheduledTask -TaskName 'BevShopDailyBackup' -Action $action -Trigger $trigger -Settings $settings -Description 'Encrypted daily backup of the beverage shop database; reads configuration from the backend .env.' -Force | Select-Object TaskName, State
