# Shared helpers for the deploy scripts. Sourced, never executed.
# shellcheck shell=bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_DIR="$(cd "${DEPLOY_DIR}/.." && pwd)"
ENVIRONMENTS_DIR="${DEPLOY_DIR}/environments"

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

# --------------------------------------------------------------------------
# Which environment are we operating on?
#
# There is deliberately NO default. Guessing "production" is how someone ends
# up pointing a staging provision at the live database, so a script that cannot
# work out its environment stops and says so.
#
# Order: --env on the command line, then SUPTUR_ENV, then the .deploy-env
# marker written into each clone by provision.sh. Because this file is sourced
# with no arguments of its own, "$@" here is the CALLING script's argument
# list — so every script gets --env for free.
# --------------------------------------------------------------------------
_env_from_args() {
	local prev='' arg
	for arg in "$@"; do
		[[ ${prev} == --env || ${prev} == -e ]] && { printf '%s' "${arg}"; return 0; }
		[[ ${arg} == --env=* ]] && { printf '%s' "${arg#--env=}"; return 0; }
		prev="${arg}"
	done
}

DEPLOY_ENV="$(_env_from_args "$@")"
[[ -n ${DEPLOY_ENV} ]] || DEPLOY_ENV="${SUPTUR_ENV:-}"
if [[ -z ${DEPLOY_ENV} && -f ${REPO_DIR}/.deploy-env ]]; then
	DEPLOY_ENV="$(tr -d '[:space:]' < "${REPO_DIR}/.deploy-env")"
fi

if [[ -z ${DEPLOY_ENV} ]]; then
	die "no environment selected.
     Pass --env <name>, or write one into ${REPO_DIR}/.deploy-env
     Available: $(cd "${ENVIRONMENTS_DIR}" && printf '%s ' *.env | sed 's/\.env//g')"
fi

# The name becomes part of a path, so it is validated rather than trusted.
[[ ${DEPLOY_ENV} =~ ^[a-z][a-z0-9-]*$ ]] \
	|| die "invalid environment name: '${DEPLOY_ENV}'"

ENV_FILE="${ENVIRONMENTS_DIR}/${DEPLOY_ENV}.env"
[[ -f ${ENV_FILE} ]] || die "no such environment: ${DEPLOY_ENV} (${ENV_FILE} does not exist)"

# shellcheck source=/dev/null
source "${ENV_FILE}"

# The caller's arguments with --env and its value removed, so the scripts that
# take positional arguments (backup.sh's label, rollback.sh's release name) do
# not each have to know about the flag.
ARGS=()
_skip=0
for _arg in "$@"; do
	if ((_skip)); then _skip=0; continue; fi
	case "${_arg}" in
		--env|-e) _skip=1 ;;
		--env=*) ;;
		*) ARGS+=("${_arg}") ;;
	esac
done
unset _skip _arg

SUPABASE_DIR="${DEPLOY_ROOT}/supabase"
APP_DIR="${DEPLOY_ROOT}/app"
RELEASES_DIR="${APP_DIR}/releases"
CURRENT_LINK="${APP_DIR}/current"
SHARED_ENV="${APP_DIR}/shared/.env"
SECRETS_ENV="${DEPLOY_ROOT}/secrets.env"
BACKUP_DIR="${DEPLOY_ROOT}/backups"
STATE_DIR="${DEPLOY_ROOT}/state"

# A 0/1 flag from the environment file.
is_enabled() { [[ ${!1:-0} == 1 ]]; }

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

# --------------------------------------------------------------------------
# Locking
#
# Two environments now share one box, one Docker daemon and 8 GB of RAM. Two
# `npm ci` + `vite build` runs at once is a plausible OOM, and two deploys in
# the same environment would race for the release symlink.
#
# The per-environment lock lives under DEPLOY_ROOT, which the deploy user owns.
# The build lock is shared ACROSS environments, so it cannot live there — and
# /srv itself is root-owned. /tmp is right for it: both environments run as the
# same user, and a lock that vanishes on reboot is exactly what you want.
# --------------------------------------------------------------------------
BUILD_LOCK=/tmp/suptur-build.lock
LOCK_WAIT="${LOCK_WAIT:-1800}"

with_lock() {
	local lockfile=$1 label=$2; shift 2
	local fd rc=0
	exec {fd}>"${lockfile}" || die "cannot open lock file ${lockfile}"
	if ! flock -w "${LOCK_WAIT}" "${fd}"; then
		die "timed out after ${LOCK_WAIT}s waiting for the ${label} lock (${lockfile}).
     Another deploy is probably still running: pgrep -af deploy.sh"
	fi
	"$@" || rc=$?
	exec {fd}>&-
	return ${rc}
}

# Refuse the docker commands that would take the database with them.
# `down -v` and `volume prune` are the two that turn a re-provision into data
# loss.
#
# -p is not optional. Without it Compose names the project after the project
# DIRECTORY, which is "supabase" for both /srv/suptur/supabase and
# /srv/suptur-staging/supabase — so staging would adopt and restart
# production's containers.
compose() {
	local arg extra=()
	for arg in "$@"; do
		case "${arg}" in
			-v|--volumes) die "refusing 'docker compose $*': that deletes Supabase volumes" ;;
		esac
	done
	if [[ -f ${SUPABASE_DIR}/docker-compose.${DEPLOY_ENV}.yml ]]; then
		extra=(-f "${SUPABASE_DIR}/docker-compose.${DEPLOY_ENV}.yml")
	fi
	docker compose \
		-p "${APP_NAME}" \
		--project-directory "${SUPABASE_DIR}" \
		-f "${SUPABASE_DIR}/docker-compose.yml" \
		-f "${SUPABASE_DIR}/docker-compose.override.yml" \
		"${extra[@]}" \
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

	# Staging sets ENABLE_ALERTS=0. Its watchdog still runs and still restarts a
	# dead app — what we are avoiding is being woken at 03:00 for the one
	# environment whose entire purpose is that it is allowed to be broken.
	if ! is_enabled ENABLE_ALERTS; then
		warn "ALERT (${DEPLOY_ENV}, not emailed — ENABLE_ALERTS=0): ${subject}"
		printf '%s\n' "${body}" >&2
		return 0
	fi

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

	# The subject carries APP_NAME so a staging alert that somehow does get sent
	# is never mistaken for a production one.
	printf 'From: %s\nTo: %s\nSubject: [%s] %s\n\n%s\n' \
		"${SMTP_ADMIN_EMAIL:-${SMTP_USER}}" "${ALERT_EMAIL}" "${APP_NAME}" "${subject}" "${body}" \
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
