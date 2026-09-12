<#
.SYNOPSIS
    Opens Supabase Studio for one environment through an SSH tunnel.

.DESCRIPTION
    Studio is served by the same gateway as the API, so Caddy deliberately does
    not forward it — only /rest, /auth, /storage and /realtime are public. That
    keeps the dashboard off the internet entirely; this tunnel is how you reach it.

    Leave the window open while you use Studio; Ctrl+C closes the tunnel.

    The local port defaults to the environment's own gateway port, so a
    production and a staging tunnel can be open at the same time without
    colliding — and so the port in your browser tells you which one you are
    looking at.

.EXAMPLE
    .\Open-Studio.ps1 -Env staging
    .\Open-Studio.ps1 -Env production
#>
param(
    [Parameter(Mandatory)][ValidateSet('production', 'staging')][string]$Env,
    [int]$LocalPort
)

. "$PSScriptRoot\Common.ps1"

$config = Get-DeployConfig -Env $Env
Test-SshReady

$remotePort = $config['API_PORT']
if (-not $LocalPort) { $LocalPort = [int]$remotePort }

$creds = & ssh suptur "grep -E '^DASHBOARD_(USERNAME|PASSWORD)=' $($config['DEPLOY_ROOT'])/supabase/.env"
Write-Host "`n$Env Studio login:" -ForegroundColor Cyan
$creds | ForEach-Object { Write-Host "  $_" }

Write-Host "`nOpening http://localhost:$LocalPort ($Env) — Ctrl+C to close the tunnel.`n" -ForegroundColor Cyan
Start-Process "http://localhost:$LocalPort"

& ssh -N -L "${LocalPort}:127.0.0.1:${remotePort}" suptur
