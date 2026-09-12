#!/usr/bin/env bash
#
# Renders the Caddy vhost, the systemd units and the deploy user's sudoers rule
# from the templates in git and installs them, for ONE environment. Run as
# root, normally via provision.sh rather than directly.
#
#   sudo install-system-units.sh --env <production|staging>
#
# Idempotent: re-rendering identical content is a no-op, and services are only
# restarted when their unit actually changed.
#
# Unit file NAMES come from APP_NAME, not from the template filename. That is
# not cosmetic: the templates are shared between environments, so deriving the
# installed name from the file on disk would make provisioning staging write
# staging's ExecStart into production's suptur.service.

set -Eeuo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "${DEPLOY_DIR}/.." && pwd)"

DEPLOY_ENV=""
while [[ $# -gt 0 ]]; do
	case $1 in
		--env) DEPLOY_ENV=$2; shift 2 ;;
		--env=*) DEPLOY_ENV=${1#--env=}; shift ;;
		-h|--help) sed -n '2,16p' "$0"; exit 0 ;;
		*) echo "unknown argument: $1" >&2; exit 1 ;;
	esac
done

[[ -n ${DEPLOY_ENV} ]] || DEPLOY_ENV="${SUPTUR_ENV:-}"
if [[ -z ${DEPLOY_ENV} && -f ${REPO_DIR}/.deploy-env ]]; then
	DEPLOY_ENV="$(tr -d '[:space:]' < "${REPO_DIR}/.deploy-env")"
fi
[[ -n ${DEPLOY_ENV} ]] || { echo "no environment selected; pass --env <name>" >&2; exit 1; }
[[ ${DEPLOY_ENV} =~ ^[a-z][a-z0-9-]*$ ]] || { echo "invalid environment: ${DEPLOY_ENV}" >&2; exit 1; }

ENV_FILE="${DEPLOY_DIR}/environments/${DEPLOY_ENV}.env"
[[ -f ${ENV_FILE} ]] || { echo "no such environment: ${ENV_FILE}" >&2; exit 1; }
# shellcheck source=/dev/null
source "${ENV_FILE}"

[[ ${EUID} -eq 0 ]] || { echo "must run as root" >&2; exit 1; }

# The unprivileged account that owns the deploy tree and runs the app.
DEPLOY_USER="${SUDO_USER:-$(stat -c '%U' "${DEPLOY_DIR}")}"
APP_DIR="${DEPLOY_ROOT}/app"
SHARED_ENV="${APP_DIR}/shared/.env"
BASIC_AUTH_FILE="${DEPLOY_ROOT}/basic-auth.env"

# --------------------------------------------------------------------------
# The environment root. /srv is root-owned, so the deploy user cannot create
# its own tree — this is the one step that can, and it runs before provision.sh
# needs to write anything into it.
# --------------------------------------------------------------------------
if [[ ! -d ${DEPLOY_ROOT} ]]; then
	install -d -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${DEPLOY_ROOT}"
	echo "  created ${DEPLOY_ROOT}"
fi

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

	# Staging has no redirect hosts at all; skip the DNS work entirely.
	[[ -n ${REDIRECT_DOMAINS} ]] || return 0

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

	((${#kept[@]})) && printf '%s' "${kept[*]}"
}

USABLE_REDIRECT_HOSTS="$(filter_redirect_hosts)"

# Basic-auth credentials are minted by provision.sh, never by hand. If the file
# is missing the block is stripped rather than rendering a half-built directive
# that Caddy would reject.
BASIC_AUTH_USER=""
BASIC_AUTH_HASH=""
if [[ -f ${BASIC_AUTH_FILE} ]]; then
	BASIC_AUTH_USER="$(sed -n 's/^BASIC_AUTH_USER=//p' "${BASIC_AUTH_FILE}" | head -n1)"
	BASIC_AUTH_HASH="$(sed -n 's/^BASIC_AUTH_HASH=//p' "${BASIC_AUTH_FILE}" | head -n1)"
fi

want_auth=0
[[ ${BASIC_AUTH:-0} == 1 && -n ${BASIC_AUTH_USER} && -n ${BASIC_AUTH_HASH} ]] && want_auth=1
if [[ ${BASIC_AUTH:-0} == 1 && ${want_auth} -eq 0 ]]; then
	echo "  WARNING: BASIC_AUTH=1 but no credentials in ${BASIC_AUTH_FILE}." >&2
	echo "           ${PRIMARY_DOMAIN} will be served WITHOUT a password." >&2
fi

# Strip a fenced '# >>>NAME ... # <<<NAME' region from stdin.
strip_block() {
	sed "/# >>>$1/,/# <<<$1/d"
}

render() {
	sed \
		-e "s|__APP_NAME__|${APP_NAME}|g" \
		-e "s|__DEPLOY_ENV__|${DEPLOY_ENV}|g" \
		-e "s|__DEPLOY_USER__|${DEPLOY_USER}|g" \
		-e "s|__DEPLOY_DIR__|${DEPLOY_DIR}|g" \
		-e "s|__APP_DIR__|${APP_DIR}|g" \
		-e "s|__SHARED_ENV__|${SHARED_ENV}|g" \
		-e "s|__PRIMARY_DOMAIN__|${PRIMARY_DOMAIN}|g" \
		-e "s|__API_HOST__|${API_HOST}|g" \
		-e "s|__APP_PORT__|${APP_PORT}|g" \
		-e "s|__API_PORT__|${API_PORT}|g" \
		-e "s|__BASIC_AUTH_USER__|${BASIC_AUTH_USER}|g" \
		-e "s|__BASIC_AUTH_HASH__|${BASIC_AUTH_HASH}|g" \
		-e "s|__REDIRECT_HOSTS__|${USABLE_REDIRECT_HOSTS// /, }|g" \
		"$1" \
	| if [[ -n ${USABLE_REDIRECT_HOSTS} ]]; then grep -v 'REDIRECT_BLOCK'; else strip_block REDIRECT_BLOCK; fi \
	| if ((want_auth)); then grep -v 'AUTH_BLOCK'; else strip_block AUTH_BLOCK; fi \
	| if [[ ${NOINDEX:-0} == 1 ]]; then grep -v 'NOINDEX_BLOCK'; else strip_block NOINDEX_BLOCK; fi
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

# --------------------------------------------------------------------------
# systemd units. app*.template -> ${APP_NAME}*.
# --------------------------------------------------------------------------
changed_units=()
for template in "${DEPLOY_DIR}"/systemd/app*.template; do
	base="$(basename "${template}" .template)"     # app-backup.timer
	unit="${APP_NAME}${base#app}"                  # suptur-backup.timer
	if install_if_changed "$(render "${template}")" "/etc/systemd/system/${unit}"; then
		changed_units+=("${unit}")
		echo "  updated ${unit}"
	fi
done

# --------------------------------------------------------------------------
# sudoers. Lives here rather than in 01-bootstrap.sh because it is per
# environment: bootstrap runs once for the machine, this runs once per site.
#
# The alias NAME may only contain A-Z, 0-9 and underscore, so "suptur-staging"
# has to become SUPTUR_STAGING. visudo rejects the file otherwise and the
# deploy user is left unable to restart its own service.
# --------------------------------------------------------------------------
SUDO_ALIAS="${APP_NAME^^}"
SUDO_ALIAS="${SUDO_ALIAS//-/_}"
SUDOERS="/etc/sudoers.d/60-${APP_NAME}-deploy"
SUDOERS_TMP="$(mktemp)"
cat > "${SUDOERS_TMP}" <<EOF
# Generated by install-system-units.sh for ${DEPLOY_ENV}. Do not edit by hand.
Cmnd_Alias ${SUDO_ALIAS}_SVC = /usr/bin/systemctl restart ${APP_NAME}.service, \\
	/usr/bin/systemctl start ${APP_NAME}.service, \\
	/usr/bin/systemctl stop ${APP_NAME}.service
Cmnd_Alias ${SUDO_ALIAS}_JOURNAL = /usr/bin/journalctl --vacuum-time=24h
${DEPLOY_USER} ALL=(root) NOPASSWD: ${SUDO_ALIAS}_SVC, ${SUDO_ALIAS}_JOURNAL
EOF
if ! visudo -cf "${SUDOERS_TMP}" >/dev/null; then
	rm -f "${SUDOERS_TMP}"
	echo "sudoers rejected for ${APP_NAME}" >&2
	exit 1
fi
if install_if_changed "$(cat "${SUDOERS_TMP}")" "${SUDOERS}"; then
	chmod 440 "${SUDOERS}"
	echo "  updated $(basename "${SUDOERS}")"
fi
rm -f "${SUDOERS_TMP}"

# --------------------------------------------------------------------------
# Caddy
# --------------------------------------------------------------------------
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
	"${APP_NAME}-maintenance.timer" >/dev/null

# Staging's database is disposable by design, so nightly pg_dumps of it are
# pure noise and disk. Disabled rather than never installed, so flipping
# ENABLE_BACKUPS back on is one re-provision.
if [[ ${ENABLE_BACKUPS:-0} == 1 ]]; then
	systemctl enable --now "${APP_NAME}-backup.timer" >/dev/null
else
	systemctl disable --now "${APP_NAME}-backup.timer" >/dev/null 2>&1 || true
	echo "  backup timer disabled (ENABLE_BACKUPS=0)"
fi

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

echo "system units installed for ${DEPLOY_ENV} (${APP_NAME})"
