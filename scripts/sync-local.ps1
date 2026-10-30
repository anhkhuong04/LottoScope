param(
    [string]$UvPath = 'uv',
    [switch]$Reconcile
)

$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
$settingsPath = Join-Path $repoPath '.env'
$localSettings = @{}
foreach ($line in Get-Content -LiteralPath $settingsPath -Encoding UTF8) {
    if ($line -match '^([A-Z_]+)=(.*)$') {
        $localSettings[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
    }
}
if ($localSettings['LOTTO_SCHEDULER_ENABLED'] -ne 'false') {
    throw 'Set LOTTO_SCHEDULER_ENABLED=false in .env before using the host collector.'
}
$apiPort = if ($localSettings['BACKEND_PORT']) { $localSettings['BACKEND_PORT'] } else { '8000' }
try {
    $null = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$apiPort/health/ready" -TimeoutSec 3
} catch {
    exit 0 # Docker is off/not ready; the next scheduled pass will check again.
}
$dbPort = if ($localSettings['POSTGRES_PORT']) { $localSettings['POSTGRES_PORT'] } else { '5432' }
$databaseUrl = $localSettings['LOTTO_DATABASE_URL']
if (-not $databaseUrl) { throw 'LOTTO_DATABASE_URL is required in .env.' }
$env:LOTTO_DATABASE_URL = $databaseUrl.Replace('@postgres:5432/', "@127.0.0.1:$dbPort/")
$env:LOTTO_SCHEDULER_ENABLED = 'false'
if ($localSettings['LOTTO_SOURCE_REQUEST_INTERVAL']) {
    $env:LOTTO_SOURCE_REQUEST_INTERVAL = $localSettings['LOTTO_SOURCE_REQUEST_INTERVAL']
}
$logPath = Join-Path $repoPath 'collector-local.log'
$runArgs = @('run', '--locked', 'python', '-m', 'app.commands.sync_games')
if ($Reconcile) { $runArgs += '--recheck-recent' }
Push-Location (Join-Path $repoPath 'backend')
try {
    # Native stderr contains normal Python logging. Capture it without PowerShell
    # promoting an INFO line to a terminating NativeCommandError.
    $ErrorActionPreference = 'Continue'
    & $UvPath @runArgs 2>&1 | ForEach-Object { $_.ToString() } |
        Out-File -LiteralPath $logPath -Encoding UTF8 -Append
    $runExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $runExitCode
