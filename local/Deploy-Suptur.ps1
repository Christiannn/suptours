<#
.SYNOPSIS
    Builds and releases the site on the VPS.

.DESCRIPTION
    A thin wrapper: all the real work lives in deploy/scripts/deploy.sh on the
    server, so a deploy done from here and one done over SSH by hand are the
    same code path.

.EXAMPLE
    .\Deploy-Suptur.ps1
    .\Deploy-Suptur.ps1 -Ref development
    .\Deploy-Suptur.ps1 -DryRun
#>
param(
    [string]$Ref,
    [switch]$DryRun,
    [switch]$SkipBackup
)

. "$PSScriptRoot\Common.ps1"

$config = Get-DeployConfig
Test-SshReady

# The server pulls straight from GitHub, so anything not pushed will not ship.
$branch = if ($Ref) { $Ref } else { $config['GIT_BRANCH'] }
Write-Host "Deploying '$branch' to $($config['PRIMARY_DOMAIN'])" -ForegroundColor Cyan

$flags = @()
if ($Ref)        { $flags += "--ref $Ref" }
if ($DryRun)     { $flags += '--dry-run' }
if ($SkipBackup) { $flags += '--skip-backup' }

$started = Get-Date
$exit = Invoke-Remote "cd ~/suptours && git pull --quiet --ff-only && deploy/scripts/deploy.sh $($flags -join ' ')"
$elapsed = [math]::Round(((Get-Date) - $started).TotalSeconds)

if ($exit -eq 0) {
    Write-Host "`nDeployed in ${elapsed}s -> https://$($config['PRIMARY_DOMAIN'])" -ForegroundColor Green
} else {
    Write-Host "`nDeploy FAILED after ${elapsed}s (exit $exit)." -ForegroundColor Red
    Write-Host "The previous release was restored automatically if it had started." -ForegroundColor Yellow
    Write-Host "Logs:  ssh suptur 'journalctl -u $($config['APP_NAME']) -n 100 --no-pager'" -ForegroundColor Yellow
    exit $exit
}
