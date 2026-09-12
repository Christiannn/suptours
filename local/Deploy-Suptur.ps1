<#
.SYNOPSIS
    Builds and releases the site on the VPS.

.DESCRIPTION
    A thin wrapper: all the real work lives in deploy/scripts/deploy.sh on the
    server, so a deploy done from here and one done over SSH by hand are the
    same code path.

    -Env is mandatory. There is no default, because the difference between the
    two is the difference between a throwaway environment and the live site.

    Production additionally makes you type the domain, and deploy.sh refuses
    any ref outside ALLOWED_REFS for the environment unless -ForceRef is given.

.EXAMPLE
    .\Deploy-Suptur.ps1 -Env staging
    .\Deploy-Suptur.ps1 -Env staging -Ref feature/new-booking-flow
    .\Deploy-Suptur.ps1 -Env production
    .\Deploy-Suptur.ps1 -Env production -Ref v2026.09.12-1
    .\Deploy-Suptur.ps1 -Env staging -DryRun
#>
param(
    [Parameter(Mandatory)][ValidateSet('production', 'staging')][string]$Env,
    [string]$Ref,
    [switch]$DryRun,
    [switch]$SkipBackup,
    [switch]$ForceRef,
    [switch]$Yes
)

. "$PSScriptRoot\Common.ps1"

$config = Get-DeployConfig -Env $Env
Test-SshReady

# The server pulls straight from GitHub, so anything not pushed will not ship.
$branch = if ($Ref) { $Ref } else { $config['GIT_BRANCH'] }
$domain = $config['PRIMARY_DOMAIN']
$clone = $config['REMOTE_CLONE']

Write-Host "Deploying '$branch' to $Env — https://$domain" -ForegroundColor Cyan

if (-not $DryRun) {
    Confirm-Environment -Config $config -Action 'deploy to' -Yes:$Yes
}

$flags = @("--env $Env")
if ($Ref)        { $flags += "--ref $Ref" }
if ($DryRun)     { $flags += '--dry-run' }
if ($SkipBackup) { $flags += '--skip-backup' }
if ($ForceRef)   { $flags += '--force-ref' }

# Each environment has its own clone, checked out on its own branch. That is
# what lets staging exercise a change to the deploy scripts themselves before
# it reaches production: the scripts come from the clone's working tree, while
# the app is built from `git archive <ref>`.
$started = Get-Date
# A wrong path here otherwise surfaces as a confusing "deploy.sh: not found".
$probe = Invoke-Remote "test -d $clone/deploy/scripts"
if ($probe -ne 0) {
    throw "No deploy scripts at ${clone} on the VPS. Fix REMOTE_CLONE in deploy/environments/$Env.env, or clone the repo there."
}

$exit = Invoke-Remote "cd $clone && git pull --quiet --ff-only && deploy/scripts/deploy.sh $($flags -join ' ')"
$elapsed = [math]::Round(((Get-Date) - $started).TotalSeconds)

if ($exit -eq 0) {
    Write-Host "`nDeployed in ${elapsed}s -> https://$domain" -ForegroundColor Green
} else {
    Write-Host "`nDeploy FAILED after ${elapsed}s (exit $exit)." -ForegroundColor Red
    Write-Host "The previous release was restored automatically if it had started." -ForegroundColor Yellow
    Write-Host "Logs:  ssh suptur 'journalctl -u $($config['APP_NAME']) -n 100 --no-pager'" -ForegroundColor Yellow
    exit $exit
}
