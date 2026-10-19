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
$taskSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$baseArgs = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$workerPath`" -UvPath `"$uvPath`""
$pollAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $baseArgs -WorkingDirectory $repoPath
$pollTriggers = @(
    (New-ScheduledTaskTrigger -Daily -At '18:30'),
    (New-ScheduledTaskTrigger -Daily -At '21:15')
)
$null = Register-ScheduledTask -TaskName $taskNames[0] -Action $pollAction -Trigger $pollTriggers `
    -Settings $taskSettings -Principal $principal -Description 'Latest-only LottoScope sync at 18:30 and 21:15 Windows local time.' -Force
# Retire the previous daily schedule; reconciliation remains available manually.
if (Get-ScheduledTask -TaskName $taskNames[1] -ErrorAction SilentlyContinue) {
    $null = Disable-ScheduledTask -TaskName $taskNames[1]
}
Write-Output 'Installed LottoScope-LocalSync (18:30 and 21:15 local); automatic reconciliation disabled.'
