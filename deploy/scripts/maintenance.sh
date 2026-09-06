#!/usr/bin/env bash
#
# Daily housekeeping. The point of this script is that a small VPS dies of disk
# exhaustion far more often than of anything dramatic, and almost always
# because of logs nobody configured a limit for.
#
# It never touches Supabase volumes, and never removes Docker volumes.

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

trap - ERR
set +e

log "Disk before: $(df -h --output=avail "${DEPLOY_ROOT}" | tail -1 | tr -d ' ') available"

# --------------------------------------------------------------------------
# 1. Logs
# --------------------------------------------------------------------------
log "Trimming the systemd journal to 24 hours"
sudo journalctl --vacuum-time=24h 2>&1 | tail -2

# Caddy rotates its own access logs (roll_keep_for 24h in the site config), but
# sweep anything left behind by an older config or a crash.
log "Removing Caddy logs older than 24 hours"
find /var/log/caddy -type f -name '*.log.*' -mmin +1440 -print -delete 2>/dev/null \
	| sed 's/^/  removed /' || true

# Docker's json-file driver is capped in /etc/docker/daemon.json (set by
# 01-bootstrap.sh), so container logs are bounded rather than swept here.

# --------------------------------------------------------------------------
# 2. Docker images and build cache — never volumes
# --------------------------------------------------------------------------
log "Pruning unused Docker images and build cache"
docker image prune -af --filter 'until=168h' 2>&1 | tail -1
docker builder prune -af --filter 'until=168h' 2>&1 | tail -1
# `docker volume prune` and `docker system prune --volumes` are deliberately
# absent: either one would take the Postgres data directory with it.

# --------------------------------------------------------------------------
# 3. Releases and backups
# --------------------------------------------------------------------------
log "Pruning releases beyond the newest ${RELEASES_TO_KEEP}"
keep="$(readlink -f "${CURRENT_LINK}" 2>/dev/null)"
find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null \
	| sort -r \
	| tail -n "+$((RELEASES_TO_KEEP + 1))" \
	| while read -r old; do
		[[ ${RELEASES_DIR}/${old} == "${keep}" ]] && continue
		rm -rf "${RELEASES_DIR:?}/${old}" && echo "  removed ${old}"
	done

log "Pruning backups older than ${BACKUP_RETENTION_DAYS} days"
find "${BACKUP_DIR}" -maxdepth 1 -type f -name '*.gz' \
	-mtime "+${BACKUP_RETENTION_DAYS}" -print -delete 2>/dev/null \
	| sed 's/^/  removed /' || true

# --------------------------------------------------------------------------
# 4. Database upkeep
# --------------------------------------------------------------------------
# Autovacuum handles the routine work; this is the periodic ANALYZE that keeps
# the planner's statistics honest as the tables grow.
if [[ $(date +%u) == 7 ]]; then
	log "Weekly VACUUM ANALYZE"
	compose exec -T db psql -U postgres -d postgres -c 'VACUUM (ANALYZE);' 2>&1 | tail -1
fi

log "Slowest statements (mean execution time)"
compose exec -T db psql -U postgres -d postgres -qtAX -c "
	SELECT round(mean_exec_time)::text || ' ms  ' ||
	       calls::text || ' calls  ' ||
	       left(regexp_replace(query, '\s+', ' ', 'g'), 90)
	FROM pg_stat_statements
	WHERE query NOT LIKE '%pg_stat_statements%'
	ORDER BY mean_exec_time DESC
	LIMIT 5;
" 2>/dev/null | sed 's/^/  /' || log "  (pg_stat_statements not available yet)"

# --------------------------------------------------------------------------
# 5. Report
# --------------------------------------------------------------------------
avail="$(df -h --output=avail "${DEPLOY_ROOT}" | tail -1 | tr -d ' ')"
used_pct="$(df --output=pcent "${DEPLOY_ROOT}" | tail -1 | tr -dc '0-9')"
log "Disk after: ${avail} available (${used_pct}% used)"

# If housekeeping ran and the disk is still filling, that is a real trend and
# worth an email — the watchdog only fires at the hard threshold.
if ((used_pct >= DISK_WARN_PERCENT)); then
	send_alert "[${APP_NAME}] disk still ${used_pct}% full after housekeeping" \
		"Daily maintenance completed but ${DEPLOY_ROOT} is ${used_pct}% full (${avail} free).

$(du -sh "${BACKUP_DIR}" "${RELEASES_DIR}" "${SUPABASE_DIR}/volumes" 2>/dev/null)

Consider lowering BACKUP_RETENTION_DAYS or RELEASES_TO_KEEP in deploy/config.env."
fi

ok "Maintenance complete"
