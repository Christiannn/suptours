#!/usr/bin/env bash
#
# Throws away the staging database and rebuilds it from migrations plus
# supabase/seed-data.sql.
#
#   reset-staging-db.sh --env staging [--yes]
#
# This is the other half of the decision that staging holds no production data:
# because nothing in it is precious, getting back to a known-good schema is a
# one-liner rather than a restore. Use it when a migration went wrong, when the
# data has drifted somewhere useless, or before testing a migration properly.
#
# It will not run against any environment but staging, and the check is on the
# resolved DEPLOY_ROOT rather than the name — an environment file that merely
# calls itself "staging" while pointing at /srv/suptur is exactly the mistake
# worth catching.

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

require_not_root
for cmd in docker npx; do need_cmd "${cmd}"; done

ASSUME_YES=0
while [[ $# -gt 0 ]]; do
	case $1 in
		--env) shift 2 || die "--env needs a value" ;;
		--env=*) shift ;;
		--yes|-y) ASSUME_YES=1; shift ;;
		-h|--help) sed -n '2,17p' "$0"; exit 0 ;;
		*) die "unknown argument: $1" ;;
	esac
done

# --------------------------------------------------------------------------
# Refuse anywhere but staging. Three independent checks, because the cost of
# being wrong here is the production database.
# --------------------------------------------------------------------------
[[ ${DEPLOY_ENV} == staging ]] \
	|| die "refusing to run against '${DEPLOY_ENV}'. This script only ever touches staging."

is_enabled ENABLE_BACKUPS \
	&& die "refusing: ${DEPLOY_ENV} has ENABLE_BACKUPS=1, which marks it as an
     environment whose data is worth keeping. That is not staging."

production_root="$(env_get "${ENVIRONMENTS_DIR}/production.env" DEPLOY_ROOT)"
[[ -n ${production_root} && ${DEPLOY_ROOT} == "${production_root}" ]] \
	&& die "refusing: ${DEPLOY_ENV} resolves to ${DEPLOY_ROOT}, which is production's root."

[[ -f ${SUPABASE_DIR}/.env ]] || die "staging is not provisioned yet — run provision.sh first"
POSTGRES_PASSWORD="$(env_get "${SUPABASE_DIR}/.env" POSTGRES_PASSWORD)"
[[ -n ${POSTGRES_PASSWORD} ]] || die "POSTGRES_PASSWORD missing from ${SUPABASE_DIR}/.env"

DB_URL="postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:${DB_PORT}/postgres"
RELEASE="$(readlink -f "${CURRENT_LINK}" 2>/dev/null || true)"
[[ -n ${RELEASE} && -d ${RELEASE} ]] \
	|| die "no current release at ${CURRENT_LINK} — the migrations and seed come from it"

if ((!ASSUME_YES)); then
	cat <<-EOF

	  This DROPS every table, row and uploaded-file record in the STAGING
	  database at ${DEPLOY_ROOT} (port ${DB_PORT}) and rebuilds it from:

	    migrations  ${RELEASE}/supabase/migrations
	    seed data   ${RELEASE}/supabase/seed-data.sql

	  Production at ${production_root:-/srv/suptur} is not touched.

	EOF
	read -rp "  Type 'reset staging' to continue: " confirm
	[[ ${confirm} == "reset staging" ]] || die "aborted"
fi

# --------------------------------------------------------------------------
# Drop and rebuild
# --------------------------------------------------------------------------
# `supabase db reset` wants a local project; against a self-hosted database the
# honest equivalent is to drop the schemas the migrations own and let them run
# again from an empty slate. auth and storage are left alone — they belong to
# GoTrue and the storage service, which recreate what they need, and dropping
# them would take the service accounts with them.
log "Dropping the public schema"
compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<-'SQL'
	DROP SCHEMA IF EXISTS public CASCADE;
	CREATE SCHEMA public;
	GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
	GRANT ALL ON SCHEMA public TO postgres;
	-- Forget which migrations ran, so they all run again against the empty
	-- schema rather than being skipped as already-applied.
	DELETE FROM supabase_migrations.schema_migrations;
SQL

log "Clearing staging's auth users"
# Seed data references no real people, and leaving orphaned auth.users behind
# would make "count the users" a useless check after a reset.
compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
	-c 'TRUNCATE auth.users CASCADE;' >/dev/null

log "Re-applying migrations"
(
	cd "${RELEASE}" || die "cannot enter ${RELEASE}"
	npx --yes supabase db push --db-url "${DB_URL}" --yes
)

log "Loading seed data"
if [[ -f ${RELEASE}/supabase/seed-data.sql ]]; then
	compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
		< "${RELEASE}/supabase/seed-data.sql" >/dev/null
	ok "Seed data loaded"
else
	warn "no supabase/seed-data.sql in ${RELEASE} — schema rebuilt, but empty"
fi

log "Restarting ${APP_NAME}"
sudo systemctl restart "${APP_NAME}.service"
wait_for_http "http://127.0.0.1:${APP_PORT}/healthz" \
	&& ok "Staging reset and healthy at $(site_origin)" \
	|| die "staging is not answering after the reset: journalctl -u ${APP_NAME} -n 50"
