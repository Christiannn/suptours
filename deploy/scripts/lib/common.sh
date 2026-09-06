# Shared helpers for the deploy scripts. Sourced, never executed.
# shellcheck shell=bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_DIR="$(cd "${DEPLOY_DIR}/.." && pwd)"

# shellcheck source=/dev/null
source "${DEPLOY_DIR}/config.env"

SUPABASE_DIR="${DEPLOY_ROOT}/supabase"
APP_DIR="${DEPLOY_ROOT}/app"
RELEASES_DIR="${APP_DIR}/releases"
CURRENT_LINK="${APP_DIR}/current"
SHARED_ENV="${APP_DIR}/shared/.env"
SECRETS_ENV="${DEPLOY_ROOT}/secrets.env"
BACKUP_DIR="${DEPLOY_ROOT}/backups"
STATE_DIR="${DEPLOY_ROOT}/state"

if [[ -t 1 ]]; then
	_C_RESET=$'\033[0m'; _C_BLUE=$'\033[34m'; _C_YELLOW=$'\033[33m'
	_C_RED=$'\033[31m'; _C_GREEN=$'\033[32m'
else
	_C_RESET=''; _C_BLUE=''; _C_YELLOW=''; _C_RED=''; _C_GREEN=''
fi

log()  { printf '%s\n' "${_C_BLUE}==>${_C_RESET} $*"; }
ok()   { printf '%s\n' "${_C_GREEN} ok${_C_RESET} $*"; }
warn() { printf '%s\n' "${_C_YELLOW} !!${_C_RESET} $*" >&2; }
die()  { printf '%s\n' "${_C_RED}ERR${_C_RESET} $*" >&2; exit 1; }

# Report which command failed rather than exiting silently under `set -e`.
trap 'die "line ${LINENO}: \`${BASH_COMMAND}\` failed"' ERR

need_cmd() {
	command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

require_not_root() {
	[[ ${EUID} -ne 0 ]] || die "run this as the deploy user, not root (it uses the user's docker group and ssh keys)"
}

# Read one KEY=value out of an env file, ignoring comments. Empty if absent.
env_get() {
	local file=$1 key=$2
	[[ -f ${file} ]] || return 0
	sed -n "s/^${key}=//p" "${file}" | head -n1
}

# Random secret, hex only. Hex matters: these end up inside postgres:// URLs,
# where a stray '@' or '/' would silently truncate the connection string.
gen_hex() { openssl rand -hex "${1:-32}"; }

# Derived hostnames, used by both provisioning and the deploy build step.
site_origin()      { printf 'https://%s' "${PRIMARY_DOMAIN}"; }
supabase_origin()  { printf 'https://%s' "${API_HOST}"; }

# Refuse to run the docker commands that would take the database with them.
# `down -v` and `volume prune` are the two that turn a re-provision into data loss.
compose() {
	local arg
	for arg in "$@"; do
		case "${arg}" in
			-v|--volumes) die "refusing 'docker compose $*': that deletes Supabase volumes" ;;
		esac
	done
	docker compose \
		--project-directory "${SUPABASE_DIR}" \
		-f "${SUPABASE_DIR}/docker-compose.yml" \
		-f "${SUPABASE_DIR}/docker-compose.override.yml" \
		--env-file "${SUPABASE_DIR}/.env" \
		"$@"
}

# Wait for an HTTP endpoint to answer 2xx. Used after every restart.
#
# Anything after url/retries/delay is passed straight to curl — needed for
# routes the Supabase gateway treats as protected (everything under
# /auth/v1/, /rest/v1/, etc.), which reject even a health check with 401
# unless it carries a valid apikey header.
wait_for_http() {
	local url=$1 retries=${2:-${HEALTH_RETRIES}} delay=${3:-${HEALTH_RETRY_DELAY}} i
	shift $(( $# > 3 ? 3 : $# ))
	for ((i = 1; i <= retries; i++)); do
		if curl -fsS --max-time 5 -o /dev/null "$@" "${url}"; then
			return 0
		fi
		sleep "${delay}"
	done
	return 1
}

# --------------------------------------------------------------------------
# Alerting
# --------------------------------------------------------------------------

# Load the operator's SMTP details. Absent or blank is fine — alerts then go to
# the journal only, and the caller says so rather than failing.
load_secrets() {
	[[ -f ${SECRETS_ENV} ]] || return 0
	# shellcheck source=/dev/null
	set -a; source "${SECRETS_ENV}"; set +a
}

# Send one alert email. Credentials are passed on the command line rather than
# written to an ~/.msmtprc so there is exactly one file holding them.
send_alert() {
	local subject=$1 body=$2
	load_secrets

	if [[ -z ${ALERT_EMAIL:-} || -z ${SMTP_HOST:-} || -z ${SMTP_USER:-} ]]; then
		warn "ALERT (not emailed — SMTP unconfigured in ${SECRETS_ENV}): ${subject}"
		printf '%s\n' "${body}" >&2
		return 0
	fi

	if ! command -v msmtp >/dev/null 2>&1; then
		warn "ALERT (msmtp not installed): ${subject}"
		return 0
	fi

	printf 'From: %s\nTo: %s\nSubject: %s\n\n%s\n' \
		"${SMTP_ADMIN_EMAIL:-${SMTP_USER}}" "${ALERT_EMAIL}" "${subject}" "${body}" \
	| msmtp \
		--host="${SMTP_HOST}" \
		--port="${SMTP_PORT:-587}" \
		--auth=on \
		--tls=on \
		--tls-starttls=on \
		--user="${SMTP_USER}" \
		--passwordeval="printf '%s' \"${SMTP_PASS:-}\"" \
		--from="${SMTP_ADMIN_EMAIL:-${SMTP_USER}}" \
		"${ALERT_EMAIL}" \
	&& log "alert emailed: ${subject}" \
	|| warn "alert email FAILED: ${subject}"
}

# Email only when the situation changes, never on every tick. A watchdog that
# mails every two minutes during an outage gets muted, and then the next
# outage goes unnoticed.
notify_state_change() {
	local name=$1 state=$2 subject=$3 body=$4
	local file="${STATE_DIR}/${name}.state" previous=""

	mkdir -p "${STATE_DIR}"
	[[ -f ${file} ]] && previous="$(cat "${file}")"

	if [[ ${previous} != "${state}" ]]; then
		printf '%s' "${state}" > "${file}"
		send_alert "${subject}" "${body}"
		return 0
	fi
	return 1
}
