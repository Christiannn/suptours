<#
.SYNOPSIS
    Opens an interactive shell on the VPS.
.EXAMPLE
    .\Connect-Vps.ps1
    .\Connect-Vps.ps1 -Command 'docker compose -f /srv/suptur/supabase/docker-compose.yml ps'
#>
param([string]$Command)

. "$PSScriptRoot\Common.ps1"

if ($Command) {
    Invoke-Remote $Command | Out-Null
    exit $LASTEXITCODE
}
& ssh suptur
