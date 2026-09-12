<#
.SYNOPSIS
    Runs an on-demand backup and lists what is currently stored.

.DESCRIPTION
    -Download is the part that matters. The nightly timer writes to /srv/<env>/backups
    on the VPS and nothing copies it off the box, so until a copy exists
    somewhere else you have a backup of everything except the failure that
    would actually destroy the site: losing the machine.

    Register this as a weekly Windows Scheduled Task with -Download -Yes, or
    run it by hand after anything you would hate to redo.

.EXAMPLE
    .\Invoke-Backup.ps1 -Env production
    .\Invoke-Backup.ps1 -Env production -Download
    .\Invoke-Backup.ps1 -Env production -Download -Yes   # unattended
#>
param(
    [Parameter(Mandatory)][ValidateSet('production', 'staging')][string]$Env,
    [switch]$Download,
    [switch]$Verify,
    [switch]$Yes
)

. "$PSScriptRoot\Common.ps1"

$config = Get-DeployConfig -Env $Env
Test-SshReady

if ($config['ENABLE_BACKUPS'] -ne '1' -and -not $Yes) {
    Write-Host "Note: $Env sets ENABLE_BACKUPS=0 — its data is meant to be disposable." -ForegroundColor Yellow
    Write-Host "Backing up anyway because you asked." -ForegroundColor Yellow
}

$root = $config['DEPLOY_ROOT']
$clone = $config['REMOTE_CLONE']

Invoke-Remote "cd $clone && deploy/scripts/backup.sh manual --env $Env" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Backup failed.' }

Write-Host "`nBackups on the server ($Env):" -ForegroundColor Cyan
& ssh suptur "ls -lh $root/backups | tail -20"

if ($Verify) {
    Write-Host "`nVerifying the newest dump actually restores..." -ForegroundColor Cyan
    Invoke-Remote "cd $clone && deploy/scripts/verify-backup.sh --env $Env" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Backup verification FAILED — read the output above.' }
}

if ($Download) {
    $dest = Join-Path $PSScriptRoot "..\backups\$Env"
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    $dest = (Resolve-Path $dest).Path

    foreach ($pattern in @('*-db.sql.gz', '*-storage.tar.gz')) {
        $latest = (& ssh suptur "ls -t $root/backups/$pattern 2>/dev/null | head -1").Trim()
        if (-not $latest) {
            Write-Host "  no $pattern on the server yet" -ForegroundColor Yellow
            continue
        }
        Write-Host "Downloading $latest -> $dest" -ForegroundColor Cyan
        & scp -q "suptur:$latest" $dest
        if ($LASTEXITCODE -ne 0) { throw "Download of $latest failed." }
    }

    Write-Host "`nOff-box copies in $dest :" -ForegroundColor Green
    Get-ChildItem $dest | Sort-Object LastWriteTime -Descending |
        Select-Object -First 6 Name, @{n = 'Size'; e = { '{0:N1} MB' -f ($_.Length / 1MB) } }, LastWriteTime |
        Format-Table -AutoSize
}
