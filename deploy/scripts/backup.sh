#!/usr/bin/env bash
#
# Backs up everything that cannot be rebuilt from git: the Postgres database
# and the Storage objects. Called nightly by a timer and again at the top of
# every deploy, so a deploy is never the thing that loses data.
#
#   backup.sh [label]     label defaults to "manual"; deploy.sh passes "predeploy"
#
# Restore:
#   gunzip -c db-<stamp>.sql.gz | docker compose exec -T db psql -U postgres -d postgres
#   tar -xzf storage-<stamp>.tar.gz -C /srv/suptur/supabase/volumes

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

LABEL="${ARGS[0]:-manual}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
PREFIX="${BACKUP_DIR}/${STAMP}-${LABEL}"

mkdir -p "${BACKUP_DIR}"

log "Backing up database"
# Plain SQL through gzip rather than -Fc: it restores with psql alone, which is
# one less thing to get right at 3am when something has gone wrong.
compose exec -T db pg_dump -U postgres -d postgres --clean --if-exists \
	| gzip -9 > "${PREFIX}-db.sql.gz"

# A dump that failed midway still leaves a plausible-looking file, so check it.
gzip -t "${PREFIX}-db.sql.gz" || die "database dump is corrupt: ${PREFIX}-db.sql.gz"
[[ -s ${PREFIX}-db.sql.gz ]] || die "database dump is empty"
ok "database → $(du -h "${PREFIX}-db.sql.gz" | cut -f1)"

if [[ -d ${SUPABASE_DIR}/volumes/storage ]]; then
	log "Backing up storage objects"
	tar -czf "${PREFIX}-storage.tar.gz" -C "${SUPABASE_DIR}/volumes" storage
	ok "storage → $(du -h "${PREFIX}-storage.tar.gz" | cut -f1)"
fi

log "Pruning backups older than ${BACKUP_RETENTION_DAYS} days"
find "${BACKUP_DIR}" -maxdepth 1 -type f -name '*.gz' \
	-mtime "+${BACKUP_RETENTION_DAYS}" -print -delete | sed 's/^/  removed /' || true

ok "Backup complete: ${PREFIX}-*"
