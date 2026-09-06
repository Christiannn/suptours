<#
.SYNOPSIS
    Opens Supabase Studio through an SSH tunnel.

.DESCRIPTION
    Studio is served by the same gateway as the API, so Caddy deliberately does
    not forward it — only /rest, /auth, /storage and /realtime are public. That
    keeps the dashboard off the internet entirely; this tunnel is how you reach it.

    Leave the window open while you use Studio; Ctrl+C closes the tunnel.
#>
param([int]$LocalPort = 8000)

. "$PSScriptRoot\Common.ps1"

Test-SshReady

$creds = & ssh suptur "grep -E '^DASHBOARD_(USERNAME|PASSWORD)=' /srv/suptur/supabase/.env"
Write-Host "`nStudio login:" -ForegroundColor Cyan
$creds | ForEach-Object { Write-Host "  $_" }

Write-Host "`nOpening http://localhost:$LocalPort — Ctrl+C to close the tunnel.`n" -ForegroundColor Cyan
Start-Process "http://localhost:$LocalPort"

& ssh -N -L "${LocalPort}:127.0.0.1:8000" suptur
