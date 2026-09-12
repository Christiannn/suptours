#!/usr/bin/env bash
#
# Proves the newest backup actually restores.
#
#   verify-backup.sh --env <name> [--file <path-to-db.sql.gz>]
#
# backup.sh checks that the dump is valid gzip and not empty. That catches a
# truncated file and nothing else: a dump can be perfectly well-formed gzip and
# still fail to restore. The only honest test is to restore it, so that is what
# this does — into a throwaway container that is destroyed either way.
#
# It never touches the running stack, and it publishes no ports: the restore
# goes in over `docker exec`, so the scratch database is reachable from nowhere
# but this script.
#
# Run it after any change to the schema, and once in a while regardless. A
# backup nobody has ever restored is a hypothesis, not a backup.

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

require_not_root
for cmd in docker gzip; do need_cmd "${cmd}"; done

DUMP=""
while [[ $# -gt 0 ]]; do
	case $1 in
		--env) shift 2 || die "--env needs a value" ;;
		--env=*) shift ;;
		--file) DUMP=$2; shift 2 ;;
		-h|--help) sed -n '2,18p' "$0"; exit 0 ;;
		*) die "unknown argument: $1" ;;
	esac
done

if [[ -z ${DUMP} ]]; then
	DUMP="$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name '*-db.sql.gz' -printf '%T@ %p\n' \
		| sort -rn | head -n1 | cut -d' ' -f2-)"
fi
[[ -n ${DUMP} && -f ${DUMP} ]] || die "no database dump found in ${BACKUP_DIR}"

log "Verifying $(basename "${DUMP}") ($(du -h "${DUMP}" | cut -f1))"

# --------------------------------------------------------------------------
# 1. The cheap checks first
# --------------------------------------------------------------------------
gzip -t "${DUMP}" || die "not valid gzip: ${DUMP}"

# A dump that died midway is still valid gzip. pg_dump writes this marker as
# its very last line, so its absence means the dump is truncated.
if ! gunzip -c "${DUMP}" | tail -5 | grep -q 'PostgreSQL database dump complete'; then
	die "truncated: ${DUMP} has no 'dump complete' marker.
     The pg_dump that produced it did not finish."
fi
ok "gzip intact and dump is complete"

# --------------------------------------------------------------------------
# 2. Which Postgres image? Ask the running stack rather than guessing — a
#    restore tested against the wrong major version proves nothing.
# --------------------------------------------------------------------------
IMAGE=""
if db_cid="$(compose ps -q db 2>/dev/null)" && [[ -n ${db_cid} ]]; then
	IMAGE="$(docker inspect --format '{{.Config.Image}}' "${db_cid}")"
fi
if [[ -z ${IMAGE} ]]; then
	IMAGE="$(grep -oE 'supabase/postgres:[0-9][^[:space:]]*' \
		"${SUPABASE_DIR}/docker-compose.yml" "${DEPLOY_DIR}/supabase/upstream/docker-compose.yml" \
		2>/dev/null | head -n1 | cut -d: -f2-)"
fi
[[ -n ${IMAGE} ]] || die "cannot determine the Postgres image to restore into"
log "Restoring into a throwaway ${IMAGE}"

# --------------------------------------------------------------------------
# 3. Restore into a scratch container
# --------------------------------------------------------------------------
SCRATCH="${APP_NAME}-verify-$$"

cleanup() {
	docker rm -f "${SCRATCH}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# No published ports and no volume: nothing outside this script can reach it,
# and it leaves nothing behind.
docker run -d --name "${SCRATCH}" \
	-e POSTGRES_PASSWORD=verify \
	-e POSTGRES_DB=postgres \
	"${IMAGE}" >/dev/null

log "Waiting for the scratch database"
for i in {1..60}; do
	docker exec "${SCRATCH}" pg_isready -U postgres -q 2>/dev/null && break
	((i == 60)) && die "scratch database never became ready"
	sleep 2
done

log "Replaying the dump"
restore_log="$(mktemp)"
# ON_ERROR_STOP is deliberately off: the dump is --clean --if-exists, so it
# opens with DROPs against an empty database and those are expected to be
# no-ops. Real failures are counted below instead.
if ! gunzip -c "${DUMP}" \
	| docker exec -i "${SCRATCH}" psql -U postgres -d postgres -q > "${restore_log}" 2>&1; then
	tail -20 "${restore_log}" >&2
	rm -f "${restore_log}"
	die "psql exited non-zero replaying the dump"
fi

errors="$(grep -c '^ERROR:' "${restore_log}" || true)"
if ((errors > 0)); then
	warn "${errors} ERROR line(s) during restore — first few:"
	grep '^ERROR:' "${restore_log}" | head -5 >&2
fi
rm -f "${restore_log}"

# --------------------------------------------------------------------------
# 4. Did anything actually land?
# --------------------------------------------------------------------------
docker exec "${SCRATCH}" psql -U postgres -d postgres -qc 'ANALYZE;' >/dev/null 2>&1

tables="$(docker exec "${SCRATCH}" psql -U postgres -d postgres -tAc \
	"select count(*) from information_schema.tables
	 where table_schema = 'public' and table_type = 'BASE TABLE';")"
[[ ${tables} -gt 0 ]] || die "restore produced no tables in the public schema — the dump is not usable"

echo
echo "  Restored ${tables} table(s). Ten largest:"
docker exec "${SCRATCH}" psql -U postgres -d postgres -c \
	"select relname as table, n_live_tup as rows
	 from pg_stat_user_tables order by n_live_tup desc limit 10;"

# --------------------------------------------------------------------------
# 5. The storage tarball from the same run, if there is one
# --------------------------------------------------------------------------
STORAGE="${DUMP%-db.sql.gz}-storage.tar.gz"
if [[ -f ${STORAGE} ]]; then
	if tar -tzf "${STORAGE}" >/dev/null 2>&1; then
		ok "storage tarball reads cleanly ($(du -h "${STORAGE}" | cut -f1))"
	else
		die "storage tarball is corrupt: ${STORAGE}"
	fi
else
	warn "no matching storage tarball for this dump"
fi

echo
if ((errors > 0)); then
	warn "Restore completed with ${errors} error line(s) — read them above before trusting this backup."
	exit 1
fi
ok "$(basename "${DUMP}") restores cleanly"
