$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
if (-not (Select-String -LiteralPath (Join-Path $repoPath '.env') `
    -Pattern '^LOTTO_SCHEDULER_ENABLED=false\s*$' -Quiet)) {
    throw 'Set LOTTO_SCHEDULER_ENABLED=false in .env and recreate backend before installing.'
}
$workerPath = Join-Path $PSScriptRoot 'sync-local.ps1'
$uvPath = (Get-Command uv -ErrorAction Stop).Source
$userName = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$taskNames = @('LottoScope-LocalSync', 'LottoScope-Reconcile')
foreach ($taskName in $taskNames) {
    $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existing -and -not ($existing.Actions.Arguments -like "*$workerPath*")) {
        throw "Task $taskName exists for another location; inspect it before installing."
    }
}
$principal = New-ScheduledTaskPrincipal -UserId $userName -LogonType Interactive -RunLevel Limited
$taskSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$baseArgs = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$workerPath`" -UvPath `"$uvPath`""
$pollAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $baseArgs -WorkingDirectory $repoPath
$pollTriggers = @(
    (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Minutes 5)),
    (New-ScheduledTaskTrigger -AtLogOn -User $userName)
)
$null = Register-ScheduledTask -TaskName $taskNames[0] -Action $pollAction -Trigger $pollTriggers `
    -Settings $taskSettings -Principal $principal -Description 'Latest-only LottoScope sync while local Docker is ready.' -Force
$reconcileAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "$baseArgs -Reconcile" -WorkingDirectory $repoPath
$reconcileSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$dailyTrigger = New-ScheduledTaskTrigger -Daily -At '07:00'
$null = Register-ScheduledTask -TaskName $taskNames[1] -Action $reconcileAction -Trigger $dailyTrigger `
    -Settings $reconcileSettings -Principal $principal -Description 'Bounded LottoScope recent/history reconciliation.' -Force
Start-ScheduledTask -TaskName $taskNames[0]
Write-Output 'Installed LottoScope-LocalSync (5 minutes + logon) and LottoScope-Reconcile (07:00 local).'
