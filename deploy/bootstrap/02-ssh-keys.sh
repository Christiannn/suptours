#!/usr/bin/env bash
#
# Switches SSH to key-only. Run as root, AFTER your public key is installed and
# AFTER you have proven it works:
#
#   sudo deploy/bootstrap/02-ssh-keys.sh
#
# This is the one step that can lock you out, so it is kept apart from the rest
# of bootstrapping and it refuses to run unless a usable key is already in
# place. Port 22 stays open to the world at this stage — restricting it to your
# home IP comes later, once the site is up.
#
# Before running:  from your PC, `ssh suptur` must already log you in without
#                  typing a password.
# Keep open:       a second SSH session, until you have tested a third.
# If it goes wrong: your provider's web/VNC console can always undo
#                   /etc/ssh/sshd_config.d/99-hardening.conf

set -Eeuo pipefail

[[ ${EUID} -eq 0 ]] || { echo "run with sudo" >&2; exit 1; }

DEPLOY_USER="${SUDO_USER:-administrator}"
AUTH_KEYS="$(getent passwd "${DEPLOY_USER}" | cut -d: -f6)/.ssh/authorized_keys"

log() { printf '\n\033[34m==>\033[0m %s\n' "$*"; }
ok()  { printf '\033[32m ok\033[0m %s\n' "$*"; }
die() { printf '\033[31mERR\033[0m %s\n' "$*" >&2; exit 1; }

# --- the guard that makes this safe ---------------------------------------
[[ -f ${AUTH_KEYS} ]] \
	|| die "No ${AUTH_KEYS}. Run local/Setup-SshKey.ps1 from your PC first — disabling passwords now would lock you out."

KEY_COUNT="$(grep -cE '^(ssh-(rsa|ed25519)|ecdsa-)' "${AUTH_KEYS}" || true)"
((KEY_COUNT > 0)) \
	|| die "${AUTH_KEYS} contains no usable public key. Refusing to disable password login."

ok "Found ${KEY_COUNT} authorized key(s) for ${DEPLOY_USER}"

chmod 700 "$(dirname "${AUTH_KEYS}")"
chmod 600 "${AUTH_KEYS}"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "$(dirname "${AUTH_KEYS}")"

# --- harden ----------------------------------------------------------------
log "Writing /etc/ssh/sshd_config.d/99-hardening.conf"
cat > /etc/ssh/sshd_config.d/99-hardening.conf <<EOF
# Managed by deploy/bootstrap/02-ssh-keys.sh
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
AllowUsers ${DEPLOY_USER}
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
EOF

# Ubuntu 22.10+ ships socket activation, where sshd_config.d is still read but
# the port comes from the socket unit. Validating first covers both layouts.
sshd -t || die "sshd rejected the config — nothing was applied beyond writing the file. Remove /etc/ssh/sshd_config.d/99-hardening.conf and retry."
ok "sshd config validates"

# Reload, not restart: existing sessions (including this one) survive.
log "Reloading sshd"
systemctl reload ssh 2>/dev/null || systemctl reload sshd
ok "sshd reloaded"

log "Locking the root password (key login for root is already disabled)"
passwd -l root >/dev/null

cat <<EOF

$(ok "SSH is now key-only")

  DO NOT CLOSE THIS SESSION YET.

  From your PC, open a NEW terminal and confirm both:
      ssh suptur                                          -> should log in
      ssh -o PreferredAuthentications=password suptur     -> should be REFUSED

  Only then close this one.

  Change the ${DEPLOY_USER} password too, while you are here:  passwd
  (It is no longer usable over SSH, but it still guards sudo and the
   provider's console.)
EOF
