<#
.SYNOPSIS
    Creates an SSH key, installs it on the VPS, and adds a 'suptur' host alias
    so every other script can just say `ssh suptur`.

.DESCRIPTION
    Run this once, first. It still uses password authentication to copy the key
    up, so run it BEFORE deploy/bootstrap/02-ssh-keys.sh disables passwords.

.EXAMPLE
    .\Setup-SshKey.ps1
    .\Setup-SshKey.ps1 -ServerIp 85.190.105.95 -User administrator
#>
param(
    [string]$ServerIp = '85.190.105.95',
    [string]$User     = 'administrator',
    [string]$KeyName  = 'suptur_ed25519'
)

. "$PSScriptRoot\Common.ps1"

$sshDir  = Join-Path $HOME '.ssh'
$keyPath = Join-Path $sshDir $KeyName

if (-not (Test-Path $sshDir)) {
    New-Item -ItemType Directory -Path $sshDir -Force | Out-Null
}

if (Test-Path $keyPath) {
    Write-Host "Key already exists: $keyPath" -ForegroundColor Yellow
} else {
    Write-Host "Generating $keyPath ..." -ForegroundColor Cyan
    $comment = "$env:USERNAME@$env:COMPUTERNAME suptur-deploy"

    # Passing an empty passphrase to a native command differs between the two
    # PowerShell generations: 5.1 needs the literal '""', 7+ passes '' correctly
    # and would treat '""' as a two-character passphrase.
    if ($PSVersionTable.PSVersion.Major -ge 6) {
        & ssh-keygen -t ed25519 -f $keyPath -N '' -C $comment
    } else {
        & ssh-keygen -t ed25519 -f $keyPath -N '""' -C $comment
    }
    if ($LASTEXITCODE -ne 0) { throw 'ssh-keygen failed' }

    # Prove the key really has no passphrase — a silently-encrypted key would
    # only surface later, as a confusing prompt in the middle of a deploy.
    & ssh-keygen -y -P '' -f $keyPath > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "The generated key appears to have a passphrase. Delete $keyPath and re-run."
    }
}

# Windows has no ssh-copy-id. Append the key ourselves, and only if it is not
# already there, so re-running this doesn't pile up duplicates.
Write-Host "`nInstalling the public key on ${ServerIp} (you'll be asked for the ${User} password)..." -ForegroundColor Cyan
$publicKey = (Get-Content "$keyPath.pub" -Raw).Trim()
$remote = @"
set -e
mkdir -p ~/.ssh && chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
if grep -qxF '$publicKey' ~/.ssh/authorized_keys; then
  echo 'key already present'
else
  echo '$publicKey' >> ~/.ssh/authorized_keys
  echo 'key added'
fi
"@
& ssh "$User@$ServerIp" $remote
if ($LASTEXITCODE -ne 0) { throw 'Could not install the key.' }

# Host alias, so `ssh suptur` works everywhere.
$configPath = Join-Path $sshDir 'config'
$entry = @"

Host suptur
    HostName $ServerIp
    User $User
    IdentityFile $keyPath
    IdentitiesOnly yes
    ServerAliveInterval 30
"@

if ((Test-Path $configPath) -and (Select-String -Path $configPath -Pattern '^Host suptur$' -Quiet)) {
    Write-Host "'Host suptur' is already in $configPath — leaving it alone." -ForegroundColor Yellow
} else {
    Add-Content -Path $configPath -Value $entry
    Write-Host "Added 'Host suptur' to $configPath" -ForegroundColor Green
}

Write-Host "`nVerifying key login..." -ForegroundColor Cyan
& ssh -o BatchMode=yes -o ConnectTimeout=10 suptur 'echo "  connected as $(whoami) on $(hostname)"'
if ($LASTEXITCODE -ne 0) {
    throw "Key login failed. Do not run 02-ssh-keys.sh until this works."
}

Write-Host "`nDone. `ssh suptur` now works without a password." -ForegroundColor Green
Write-Host "Only now is it safe to run: sudo deploy/bootstrap/02-ssh-keys.sh" -ForegroundColor Green
