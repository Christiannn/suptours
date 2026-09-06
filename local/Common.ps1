# Shared helpers for the local (Windows) deploy scripts.
# Dot-source it:  . "$PSScriptRoot\Common.ps1"

$ErrorActionPreference = 'Stop'

# Read deploy/config.env so the domain, port and paths are defined in exactly
# one place rather than duplicated between bash and PowerShell.
function Get-DeployConfig {
    $path = Join-Path $PSScriptRoot '..\deploy\config.env' | Resolve-Path
    $config = @{}
    foreach ($line in Get-Content $path) {
        if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
        $key, $value = $line -split '=', 2
        $config[$key.Trim()] = $value.Trim().Trim('"')
    }
    return $config
}

# The SSH alias written by Setup-SshKey.ps1.
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
