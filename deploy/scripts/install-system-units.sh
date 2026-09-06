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
		-e "s|__REDIRECT_HOSTS__|${REDIRECT_DOMAINS// /, }|g" \
		"$1"
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
