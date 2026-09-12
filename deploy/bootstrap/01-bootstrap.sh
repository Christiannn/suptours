#!/usr/bin/env bash
#
# One-time (but re-runnable) base setup for the VPS. Run as root:
#
#   sudo deploy/bootstrap/01-bootstrap.sh
#
# Installs Docker, Node, Caddy and the housekeeping bits, and prepares the
# directory tree. Does NOT touch sshd — that is 02-ssh-keys.sh, kept separate
# so the one step that can lock you out is deliberate and isolated.

set -Eeuo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Deliberately environment-agnostic: this script sets up the MACHINE — Docker,
# Node, Caddy, swap, the firewall — and production and staging then share it.
# Everything per-site (the directory tree under /srv, the sudoers rule, the
# systemd units) is installed once per environment by install-system-units.sh.

[[ ${EUID} -eq 0 ]] || { echo "run with sudo" >&2; exit 1; }

DEPLOY_USER="${SUDO_USER:-administrator}"
id "${DEPLOY_USER}" >/dev/null 2>&1 || { echo "no such user: ${DEPLOY_USER}" >&2; exit 1; }

log() { printf '\n\033[34m==>\033[0m %s\n' "$*"; }
ok()  { printf '\033[32m ok\033[0m %s\n' "$*"; }

. /etc/os-release
log "Ubuntu ${VERSION_ID:-?} (${VERSION_CODENAME:-unknown}), deploy user: ${DEPLOY_USER}"

export DEBIAN_FRONTEND=noninteractive

# --------------------------------------------------------------------------
# 1. Base packages
# --------------------------------------------------------------------------
# Required and optional are installed separately. In one apt-get call a single
# unavailable package aborts the whole step — which is what happens on a
# release this new, where not every name has landed yet.
log "Installing base packages"
apt-get update -qq
apt-get install -y -qq \
	ca-certificates curl gnupg git rsync jq openssl \
	ufw fail2ban unattended-upgrades msmtp
ok "base packages"

# Nice to have, not required. Installed one at a time so a missing package is a
# warning rather than the end of the run.
#
#   postgresql-client  ad-hoc psql from the host. NOT used by any script here:
#                      backup.sh, provision.sh and maintenance.sh all run psql
#                      and pg_dump inside the db container, which already has a
#                      client matching the server version exactly. Unversioned
#                      on purpose — postgresql-client-NN is release-specific and
#                      Ubuntu 26.04 does not carry 17.
#   msmtp-mta          provides the sendmail symlink. send_alert() invokes msmtp
#                      directly, so this is cosmetic, and on a box that already
#                      has an MTA installing it would displace that MTA.
for pkg in postgresql-client msmtp-mta; do
	if apt-get install -y -qq "${pkg}" 2>/dev/null; then
		ok "${pkg}"
	else
		echo "  optional package unavailable, continuing without it: ${pkg}"
	fi
done

# --------------------------------------------------------------------------
# 2. Docker
# --------------------------------------------------------------------------
# Docker publishes per-codename suites, and a brand-new Ubuntu release usually
# lands there weeks after the distro ships. Probe for this release's suite and
# fall back to the most recent LTS rather than failing.
if ! command -v docker >/dev/null 2>&1; then
	log "Installing Docker"
	install -m 0755 -d /etc/apt/keyrings
	curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
		| gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
	chmod a+r /etc/apt/keyrings/docker.gpg

	DOCKER_SUITE="${VERSION_CODENAME}"
	if ! curl -fsI "https://download.docker.com/linux/ubuntu/dists/${DOCKER_SUITE}/Release" >/dev/null 2>&1; then
		echo "  Docker has no repository for '${VERSION_CODENAME}' yet; falling back to 'noble' (24.04)."
		DOCKER_SUITE=noble
	fi
	echo "  using Docker suite: ${DOCKER_SUITE}"

	echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${DOCKER_SUITE} stable" \
		> /etc/apt/sources.list.d/docker.list
	apt-get update -qq

	if ! apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; then
		echo "  Docker's own repository failed; falling back to Ubuntu's docker.io + compose plugin."
		rm -f /etc/apt/sources.list.d/docker.list
		apt-get update -qq
		apt-get install -y -qq docker.io docker-compose-v2
	fi
fi
docker compose version >/dev/null 2>&1 || { echo "docker compose v2 is missing" >&2; exit 1; }
ok "docker $(docker --version | cut -d' ' -f3 | tr -d ,)"

# Container logs are the classic way a small VPS fills its disk: the default
# json-file driver has no size limit at all.
log "Capping Docker log sizes"
mkdir -p /etc/docker
if [[ ! -f /etc/docker/daemon.json ]] || ! jq -e '."log-opts"."max-size"' /etc/docker/daemon.json >/dev/null 2>&1; then
	tmp=$(mktemp)
	jq -n '{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' > "${tmp}"
	if [[ -f /etc/docker/daemon.json ]]; then
		jq -s '.[0] * .[1]' /etc/docker/daemon.json "${tmp}" > /etc/docker/daemon.json.new \
			&& mv /etc/docker/daemon.json.new /etc/docker/daemon.json
	else
		mv "${tmp}" /etc/docker/daemon.json
	fi
	systemctl restart docker
fi
ok "docker log rotation: 10m x 3 per container"

usermod -aG docker "${DEPLOY_USER}"
systemctl enable --now docker >/dev/null

# --------------------------------------------------------------------------
# 3. Node and Caddy
# --------------------------------------------------------------------------
# Both of these publish codename-independent suites ("nodistro" / "any-version"),
# so unlike Docker they need no fallback on a brand-new Ubuntu.
if ! command -v node >/dev/null 2>&1 || [[ $(node -v | tr -dc '0-9.' | cut -d. -f1) -lt 20 ]]; then
	log "Installing Node 22"
	curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
		| gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
	echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
		> /etc/apt/sources.list.d/nodesource.list
	apt-get update -qq
	apt-get install -y -qq nodejs
fi
ok "node $(node -v)"

if ! command -v caddy >/dev/null 2>&1; then
	log "Installing Caddy"
	curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
		| gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes
	curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
		> /etc/apt/sources.list.d/caddy-stable.list
	apt-get update -qq
	apt-get install -y -qq caddy
fi
systemctl enable caddy >/dev/null
ok "caddy $(caddy version | head -1)"

# --------------------------------------------------------------------------
# 4. Swap
# --------------------------------------------------------------------------
# 8 GB is comfortable at rest but a Vite build alongside nine containers can
# spike. Swap turns a would-be OOM kill into a slow moment.
if ! swapon --show --noheadings | grep -q .; then
	log "Creating a 4 GB swapfile"
	fallocate -l 4G /swapfile
	chmod 600 /swapfile
	mkswap /swapfile >/dev/null
	swapon /swapfile
	grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
	sysctl -qw vm.swappiness=10
	grep -q 'vm.swappiness' /etc/sysctl.d/99-suptur.conf 2>/dev/null \
		|| echo 'vm.swappiness=10' > /etc/sysctl.d/99-suptur.conf
fi
ok "swap: $(swapon --show --noheadings --bytes | awk '{printf "%.0f GB", $3/1024/1024/1024}' | head -1)"

# --------------------------------------------------------------------------
# 5. Unattended security upgrades and fail2ban
# --------------------------------------------------------------------------
log "Enabling unattended security upgrades"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true

log "Enabling fail2ban for sshd"
cat > /etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban >/dev/null
ok "fail2ban active"

# The narrow passwordless-sudo rule used to live here. It moved to
# install-system-units.sh because it names ${APP_NAME}.service, and there is
# now more than one of those — bootstrap runs once for the machine, that runs
# once per environment.

# --------------------------------------------------------------------------
# 6. Firewall — permissive for now, locked down in the later phase
# --------------------------------------------------------------------------
# Web traffic is open to the world on both IPv4 and IPv6; that is the point of
# the box. SSH is left open too at this stage — restricting it to your home IP
# is a separate, deliberate step once the site is running.
log "Configuring ufw (web open, SSH open for now)"
sed -i 's/^IPV6=.*/IPV6=yes/' /etc/default/ufw
ufw --force default deny incoming >/dev/null
ufw --force default allow outgoing >/dev/null
ufw allow 22/tcp    comment 'ssh'   >/dev/null
ufw allow 80/tcp    comment 'http'  >/dev/null
ufw allow 443/tcp   comment 'https' >/dev/null
ufw --force enable >/dev/null
ok "ufw enabled"

# --------------------------------------------------------------------------
# 7. Shared directories
# --------------------------------------------------------------------------
# Each environment's own root under /srv is created by install-system-units.sh,
# which runs as root once per site. Only the machine-wide bits belong here.
log "Creating shared directories"
mkdir -p /var/log/caddy
chown -R caddy:caddy /var/log/caddy 2>/dev/null || true

cat <<EOF

$(ok "Bootstrap complete")

  Docker group membership only applies to NEW logins.
  Log out and back in, then check:  docker ps

Next:
  1. deploy/bootstrap/02-ssh-keys.sh   (key-only SSH — read it first)
  2. deploy/scripts/provision.sh       (as ${DEPLOY_USER}, not root)
EOF
