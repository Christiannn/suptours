#!/usr/bin/env bash
#
# Runs every two minutes from a systemd timer. Checks that the site is actually
# serving, that the Supabase containers are up, and that the disk is not about
# to fill — then emails only when something CHANGES.
#
# It deliberately distinguishes two kinds of failure, because the right
# response differs:
#
#   app not answering at all  → restart it once, then alert if still down
#   app answering with 503    → the database is the problem; restarting the app
#                               would achieve nothing, so just alert
#
# This script cannot report that its own machine is dead. That is what
# HEALTHCHECK_PING_URL is for: it is pinged on every healthy run, and the
# external service alerts when the pings stop.

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

# A failing check must not abort the run before the alert is sent.
trap - ERR
set +e

HEALTH_URL="http://127.0.0.1:${APP_PORT}/healthz"
problems=()

# --------------------------------------------------------------------------
# App
# --------------------------------------------------------------------------
status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${HEALTH_URL}")"

case "${status}" in
	200)
		app_state="ok"
		;;
	503)
		# Serving, but its dependency is not. Restarting would only add downtime.
		app_state="db-down"
		body="$(curl -s --max-time 10 "${HEALTH_URL}")"
		problems+=("Database unreachable from the app. /healthz says: ${body}")
		;;
	*)
		# 000 means the connection never completed — process gone, or wedged.
		log "App unhealthy (HTTP ${status:-000}); attempting one restart"
		sudo systemctl restart "${APP_NAME}.service"
		sleep 5
		if wait_for_http "${HEALTH_URL}" 5 3; then
			app_state="ok"
			notify_state_change app-restart restarted \
				"[${APP_NAME}] recovered after automatic restart" \
				"The app stopped answering (HTTP ${status:-000}) and was restarted by the watchdog. It is healthy again.

  journalctl -u ${APP_NAME} -n 100 --no-pager" >/dev/null
		else
			app_state="down"
			problems+=("App is not serving (HTTP ${status:-000}) and did not recover after a restart.")
		fi
		;;
esac

# Clear the restart marker once things are steady again.
[[ ${app_state} == "ok" ]] && rm -f "${STATE_DIR}/app-restart.state"

# --------------------------------------------------------------------------
# Supabase containers
# --------------------------------------------------------------------------
unhealthy="$(
	compose ps --format '{{.Service}} {{.State}} {{.Health}}' 2>/dev/null \
		| awk '$2 != "running" || ($3 != "" && $3 != "healthy") { print "  " $0 }'
)"
if [[ -n ${unhealthy} ]]; then
	problems+=("Supabase containers not healthy:
${unhealthy}")
fi

# --------------------------------------------------------------------------
# Disk and memory
# --------------------------------------------------------------------------
disk_used="$(df --output=pcent "${DEPLOY_ROOT}" | tail -1 | tr -dc '0-9')"
if ((disk_used >= DISK_WARN_PERCENT)); then
	problems+=("Disk is ${disk_used}% full (threshold ${DISK_WARN_PERCENT}%).
Largest consumers:
$(du -sh "${BACKUP_DIR}" "${RELEASES_DIR}" "${SUPABASE_DIR}/volumes" 2>/dev/null | sed 's/^/  /')")
fi

mem_available="$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)"
((mem_available < 300)) && problems+=("Only ${mem_available} MB of memory available.")

# --------------------------------------------------------------------------
# Report
# --------------------------------------------------------------------------
if ((${#problems[@]} == 0)); then
	if notify_state_change health ok \
		"[${APP_NAME}] recovered" \
		"All checks are passing again on $(hostname).

  Site:     $(site_origin)
  Checked:  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"; then
		: # recovery mail sent
	fi

	# Dead-man's switch: silence here is what makes the external service alert.
	load_secrets
	[[ -n ${HEALTHCHECK_PING_URL:-} ]] \
		&& curl -fsS --max-time 10 -o /dev/null "${HEALTHCHECK_PING_URL}"

	exit 0
fi

summary="$(printf '%s\n\n' "${problems[@]}")"
notify_state_change health "failing" \
	"[${APP_NAME}] PROBLEM on $(hostname)" \
	"$(printf '%s\n' "${summary}")
Checked: $(date -u '+%Y-%m-%d %H:%M:%S UTC')

  journalctl -u ${APP_NAME} -n 100 --no-pager
  cd ${SUPABASE_DIR} && docker compose ps"

printf '%s\n' "${problems[@]}" >&2
exit 1
