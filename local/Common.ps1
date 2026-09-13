# Shared helpers for the local (Windows) deploy scripts.
# Dot-source it:  . "$PSScriptRoot\Common.ps1"

$ErrorActionPreference = 'Stop'

# Read deploy/environments/<name>.env so the domain, ports and paths are defined
# in exactly one place rather than duplicated between bash and PowerShell.
#
# There is no default environment on purpose. Every script that can change
# something takes -Env and passes it here, so "which box am I about to touch"
# is always answered explicitly rather than assumed.
function Get-DeployConfig {
    param([Parameter(Mandatory)][ValidateSet('production', 'staging')][string]$Env)

    $path = Join-Path $PSScriptRoot "..\deploy\environments\$Env.env" | Resolve-Path
    $config = @{}
    foreach ($line in Get-Content $path) {
        if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
        $key, $value = $line -split '=', 2
        $config[$key.Trim()] = $value.Trim().Trim('"')
    }
    $config['ENV'] = $Env
    return $config
}

# The SSH alias written by Setup-SshKey.ps1. One box, both environments.
$script:SshHost = 'suptur'

function Test-SshReady {
    param([string]$SshHost = $script:SshHost)

    if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
        throw "The OpenSSH client is not available. Install it: Settings > System > Optional features > OpenSSH Client."
    }

    & ssh -o BatchMode=yes -o ConnectTimeout=8 $SshHost 'true' 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Cannot reach '$SshHost' with key authentication. Run .\Setup-SshKey.ps1 first."
    }
}

# Run a command on the VPS, streaming output as it happens rather than
# buffering it until the end — deploys take minutes and silence is unhelpful.
function Invoke-Remote {
    param(
        [Parameter(Mandatory)][string]$Command,
        [string]$SshHost = $script:SshHost
    )
    & ssh -t $SshHost $Command
    return $LASTEXITCODE
}

# Make the operator type the domain before anything touches production.
#
# Staging is meant to be cheap to redeploy, so it is never gated. Production is
# gated every time: the whole value of the prompt is that it is not routine.
function Confirm-Environment {
    param(
        [Parameter(Mandatory)][hashtable]$Config,
        [Parameter(Mandatory)][string]$Action,
        [switch]$Yes
    )

    if ($Config['ENV'] -ne 'production' -or $Yes) { return }

    $domain = $Config['PRIMARY_DOMAIN']
    Write-Host ""
    Write-Host "  About to $Action PRODUCTION — https://$domain" -ForegroundColor Yellow
    Write-Host ""
    $typed = Read-Host "  Type '$domain' to continue"
    if ($typed -ne $domain) {
        throw "Aborted: expected '$domain', got '$typed'."
    }
}
