<#
.SYNOPSIS
    Runs an on-demand backup and lists what is currently stored.
.EXAMPLE
    .\Invoke-Backup.ps1
    .\Invoke-Backup.ps1 -Download
#>
param([switch]$Download)

. "$PSScriptRoot\Common.ps1"

Test-SshReady
Invoke-Remote 'deploy/scripts/backup.sh manual' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Backup failed.' }

Write-Host "`nBackups on the server:" -ForegroundColor Cyan
& ssh suptur 'ls -lh /srv/suptur/backups | tail -20'

if ($Download) {
    $dest = Join-Path $PWD 'backups'
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    $latest = (& ssh suptur 'ls -t /srv/suptur/backups/*-db.sql.gz | head -1').Trim()
    Write-Host "`nDownloading $latest -> $dest" -ForegroundColor Cyan
    & scp "suptur:$latest" $dest
}
