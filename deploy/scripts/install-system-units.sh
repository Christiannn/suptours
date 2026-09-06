#!/usr/bin/env bash
#
# Renders the Caddy vhost and the systemd units from the templates in git and
# installs them. Run as root, normally via provision.sh rather than directly.
#
# Idempotent: re-rendering identical content is a no-op, and services are only
# restarted when their unit actually changed.

set -Eeuo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
source "${DEPLOY_DIR}/config.env"

[[ ${EUID} -eq 0 ]] || { echo "must run as root" >&2; exit 1; }

# The unprivileged account that owns the deploy tree and runs the app.
DEPLOY_USER="${SUDO_USER:-$(stat -c '%U' "${DEPLOY_DIR}")}"
APP_DIR="${DEPLOY_ROOT}/app"
SHARED_ENV="${APP_DIR}/shared/.env"

# --------------------------------------------------------------------------
# Only ask Caddy for certificates for hostnames that actually point here.
#
# A host in REDIRECT_DOMAINS whose DNS is not set yet would send Caddy into an
# endless ACME retry loop against a name it can never validate. The primary
# site still works — certificates are issued per site — but the log fills with
# failures and the redirect does nothing.
#
# Comparing against whatever PRIMARY_DOMAIN resolves to, rather than the
# machine's own interface addresses, keeps this correct behind NAT.
# --------------------------------------------------------------------------

resolve_addrs() {
	getent ahosts "$1" 2>/dev/null | awk '{print $1}' | sort -u
}

filter_redirect_hosts() {
	local primary_addrs kept=() skipped=() host addrs

	primary_addrs="$(resolve_addrs "${PRIMARY_DOMAIN}")"

	# If the primary itself does not resolve, the check has no reference point.
	# Pass everything through untouched rather than silently dropping the lot
	# because of a transient DNS problem — and say so, because Caddy is about
	# to fail on the main site too.
	if [[ -z ${primary_addrs} ]]; then
		echo "  WARNING: ${PRIMARY_DOMAIN} does not resolve. Caddy will not be able" >&2
		echo "           to get a certificate for it. Leaving redirect hosts as-is." >&2
		printf '%s' "${REDIRECT_DOMAINS}"
		return 0
	fi

	for host in ${REDIRECT_DOMAINS}; do
		addrs="$(resolve_addrs "${host}")"
		if [[ -z ${addrs} ]]; then
			skipped+=("${host} (does not resolve)")
		elif comm -12 <(printf '%s\n' "${addrs}") <(printf '%s\n' "${primary_addrs}") | grep -q .; then
			kept+=("${host}")
		else
			skipped+=("${host} (resolves elsewhere: $(echo "${addrs}" | tr '\n' ' '))")
		fi
	done

	if ((${#skipped[@]})); then
		echo "  Skipping redirect hosts — no certificate will be requested for them:" >&2
		printf '    %s\n' "${skipped[@]}" >&2
		echo "  Point them at ${PRIMARY_DOMAIN}'s address and re-run provision.sh to enable." >&2
	fi

	printf '%s' "${kept[*]}"
}

USABLE_REDIRECT_HOSTS="$(filter_redirect_hosts)"

render() {
	sed \
		-e "s|__APP_NAME__|${APP_NAME}|g" \
		-e "s|__DEPLOY_USER__|${DEPLOY_USER}|g" \
		-e "s|__DEPLOY_DIR__|${DEPLOY_DIR}|g" \
		-e "s|__APP_DIR__|${APP_DIR}|g" \
		-e "s|__SHARED_ENV__|${SHARED_ENV}|g" \
		-e "s|__PRIMARY_DOMAIN__|${PRIMARY_DOMAIN}|g" \
		-e "s|__API_HOST__|${API_HOST}|g" \
		-e "s|__APP_PORT__|${APP_PORT}|g" \
		-e "s|__REDIRECT_HOSTS__|${USABLE_REDIRECT_HOSTS// /, }|g" \
		"$1" \
	| if [[ -n ${USABLE_REDIRECT_HOSTS} ]]; then
			grep -v 'REDIRECT_BLOCK'
		else
			# An empty host list would render as `{ ... }`, which Caddy rejects.
			sed '/# >>>REDIRECT_BLOCK/,/# <<<REDIRECT_BLOCK/d'
		fi
}

# Write only if the content differs, so `systemctl restart` stays rare.
install_if_changed() {
	local content=$1 target=$2
	if [[ -f ${target} ]] && printf '%s' "${content}" | cmp -s - "${target}"; then
		return 1
	fi
	printf '%s' "${content}" > "${target}"
	return 0
}

changed_units=()
for template in "${DEPLOY_DIR}"/systemd/*.template; do
	unit="$(basename "${template}" .template)"
	if install_if_changed "$(render "${template}")" "/etc/systemd/system/${unit}"; then
		changed_units+=("${unit}")
		echo "  updated ${unit}"
	fi
done

mkdir -p /etc/caddy/sites.d /var/log/caddy
chown -R caddy:caddy /var/log/caddy 2>/dev/null || true

caddy_changed=0
install_if_changed "$(cat "${DEPLOY_DIR}/caddy/Caddyfile")" /etc/caddy/Caddyfile && caddy_changed=1
install_if_changed \
	"$(render "${DEPLOY_DIR}/caddy/sites.d/site.caddy.template")" \
	"/etc/caddy/sites.d/${PRIMARY_DOMAIN}.caddy" && caddy_changed=1

if ((${#changed_units[@]})); then
	systemctl daemon-reload
fi

# Timers are enabled unconditionally (cheap, idempotent); the app service is
# enabled but deliberately not started here — deploy.sh starts it once there is
# a release to run.
systemctl enable --now \
	"${APP_NAME}-watchdog.timer" \
	"${APP_NAME}-maintenance.timer" \
	"${APP_NAME}-backup.timer" >/dev/null
systemctl enable "${APP_NAME}.service" >/dev/null

if ((caddy_changed)); then
	if caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
		systemctl reload caddy || systemctl restart caddy
		echo "  reloaded caddy"
	else
		echo "caddy config is invalid — not reloading:" >&2
		caddy validate --config /etc/caddy/Caddyfile >&2 || true
		exit 1
	fi
fi

# A unit file change only takes effect on restart; skip it when the app has no
# release yet, and let deploy.sh handle it otherwise.
if [[ " ${changed_units[*]} " == *" ${APP_NAME}.service "* ]] \
	&& systemctl is-active --quiet "${APP_NAME}.service"; then
	systemctl restart "${APP_NAME}.service"
	echo "  restarted ${APP_NAME}.service"
fi

echo "system units installed"
