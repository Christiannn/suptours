#!/usr/bin/env bash
#
# Builds and releases the app. Safe to run repeatedly; never destroys data.
#
#   deploy.sh [--ref <git-ref>] [--dry-run] [--skip-backup]
#
# The build happens in a fresh release directory and the live symlink only
# moves once it has succeeded, so a broken build cannot take the site down. If
# the new release fails its health check, the symlink goes straight back.
#
# Note on ordering: migrations are applied BEFORE the code swap, so the new
# code never meets an old schema. They are forward-only and are not rolled back
# with the code, which means a migration must stay compatible with the release
# that preceded it.

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

require_not_root
for cmd in git node npm curl docker; do need_cmd "${cmd}"; done

REF="${GIT_BRANCH}"
DRY_RUN=0
SKIP_BACKUP=0

while [[ $# -gt 0 ]]; do
	case $1 in
		--ref) REF=$2; shift 2 ;;
		--dry-run) DRY_RUN=1; shift ;;
		--skip-backup) SKIP_BACKUP=1; shift ;;
		-h|--help) sed -n '2,20p' "$0"; exit 0 ;;
		*) die "unknown argument: $1" ;;
	esac
done

[[ -f ${SUPABASE_DIR}/.env ]] || die "Supabase is not provisioned yet — run provision.sh first"

SITE_ORIGIN="$(site_origin)"
SUPABASE_ORIGIN="$(supabase_origin)"
ANON_KEY="$(env_get "${SUPABASE_DIR}/.env" ANON_KEY)"
POSTGRES_PASSWORD="$(env_get "${SUPABASE_DIR}/.env" POSTGRES_PASSWORD)"
[[ -n ${ANON_KEY} ]] || die "ANON_KEY missing from ${SUPABASE_DIR}/.env"

# --------------------------------------------------------------------------
# 1. Back up before anything else
# --------------------------------------------------------------------------
if ((SKIP_BACKUP)); then
	warn "Skipping pre-deploy backup (--skip-backup)"
else
	"${DEPLOY_DIR}/scripts/backup.sh" predeploy
fi

# --------------------------------------------------------------------------
# 2. Fetch the requested revision
# --------------------------------------------------------------------------
# This script runs from a clone of the repo, so that clone is also the build
# source — no second copy to keep in sync or to fill the disk with.
# `git archive` reads the object database directly and never touches the
# working tree, so the checkout you are sitting in is unaffected.
[[ -d ${REPO_DIR}/.git ]] || die "${REPO_DIR} is not a git clone"

log "Fetching ${REF}"
git -C "${REPO_DIR}" fetch --quiet --prune origin
git -C "${REPO_DIR}" rev-parse --verify --quiet "origin/${REF}^{commit}" >/dev/null \
	&& RESOLVED="origin/${REF}" \
	|| RESOLVED="${REF}"
COMMIT="$(git -C "${REPO_DIR}" rev-parse --short "${RESOLVED}")"
SUBJECT="$(git -C "${REPO_DIR}" log -1 --format=%s "${RESOLVED}")"
log "Deploying ${COMMIT} — ${SUBJECT}"

if ((DRY_RUN)); then
	ok "Dry run: would deploy ${COMMIT} to ${SITE_ORIGIN}"
	exit 0
fi

# --------------------------------------------------------------------------
# 3. Build in a new release directory
# --------------------------------------------------------------------------
RELEASE="$(date -u +%Y%m%d-%H%M%S)-${COMMIT}"
RELEASE_DIR="${RELEASES_DIR}/${RELEASE}"
PREVIOUS="$(readlink -f "${CURRENT_LINK}" 2>/dev/null || true)"

# Clean up a half-built release if anything below fails.
cleanup_failed_release() {
	if [[ -d ${RELEASE_DIR} && "$(readlink -f "${CURRENT_LINK}" 2>/dev/null)" != "${RELEASE_DIR}" ]]; then
		warn "Removing failed release ${RELEASE}"
		rm -rf "${RELEASE_DIR}"
	fi
}
trap 'cleanup_failed_release' ERR

log "Creating release ${RELEASE}"
mkdir -p "${RELEASE_DIR}"
git -C "${REPO_DIR}" archive --format=tar "${RESOLVED}" | tar -x -C "${RELEASE_DIR}"

log "Installing dependencies"
npm --prefix "${RELEASE_DIR}" ci --no-audit --no-fund

# PUBLIC_SUPABASE_* come from $env/static/public and are INLINED into the
# browser bundle at build time. They have to be correct here — a restart will
# not fix them later, only another build will.
log "Building"
(
	cd "${RELEASE_DIR}" || die "cannot enter ${RELEASE_DIR}"
	PUBLIC_SUPABASE_URL="${SUPABASE_ORIGIN}" \
	PUBLIC_SUPABASE_ANON_KEY="${ANON_KEY}" \
	NODE_ENV=production \
	npm run build
)
[[ -f ${RELEASE_DIR}/build/index.js ]] || die "build produced no build/index.js"

# --------------------------------------------------------------------------
# 4. Migrations — forward-only, never seeds
# --------------------------------------------------------------------------
log "Applying database migrations"
(
	cd "${RELEASE_DIR}" || die "cannot enter ${RELEASE_DIR}"
	# --include-seed is off by default and stays off: supabase/seed.sql creates
	# the dev admin account (admin@suptours.dk / password) and must never run here.
	npx --yes supabase db push \
		--db-url "postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5432/postgres" \
		--yes
)

# Dev dependencies are only needed for the build and the migration step above.
log "Pruning dev dependencies"
npm --prefix "${RELEASE_DIR}" prune --omit=dev --no-audit --no-fund

# --------------------------------------------------------------------------
# 5. Swap and restart
# --------------------------------------------------------------------------
log "Activating ${RELEASE}"
# ln -sfn onto an existing symlink-to-directory would nest inside it; going via
# a temp name and mv -T makes the swap atomic and correct.
ln -sfn "${RELEASE_DIR}" "${CURRENT_LINK}.tmp"
mv -Tf "${CURRENT_LINK}.tmp" "${CURRENT_LINK}"

sudo systemctl restart "${APP_NAME}.service"

log "Waiting for health check"
if wait_for_http "http://127.0.0.1:${APP_PORT}/healthz"; then
	ok "Healthy"
else
	warn "New release failed its health check — rolling back"
	if [[ -n ${PREVIOUS} && -d ${PREVIOUS} ]]; then
		ln -sfn "${PREVIOUS}" "${CURRENT_LINK}.tmp"
		mv -Tf "${CURRENT_LINK}.tmp" "${CURRENT_LINK}"
		sudo systemctl restart "${APP_NAME}.service"
		wait_for_http "http://127.0.0.1:${APP_PORT}/healthz" \
			&& warn "Rolled back to $(basename "${PREVIOUS}")" \
			|| warn "Rollback target is also unhealthy"
	else
		warn "No previous release to roll back to"
	fi
	die "Deploy failed. Logs: journalctl -u ${APP_NAME} -n 100 --no-pager"
fi

trap - ERR

# --------------------------------------------------------------------------
# 6. Prune old releases
# --------------------------------------------------------------------------
log "Keeping the newest ${RELEASES_TO_KEEP} releases"
keep="$(readlink -f "${CURRENT_LINK}")"
find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' \
	| sort -r \
	| tail -n "+$((RELEASES_TO_KEEP + 1))" \
	| while read -r old; do
		[[ ${RELEASES_DIR}/${old} == "${keep}" ]] && continue
		rm -rf "${RELEASES_DIR:?}/${old}"
		echo "  removed ${old}"
	done

# Public reachability is a separate question from local health: this is what
# catches DNS, certificates or Caddy being wrong.
if curl -fsS --max-time 10 -o /dev/null "${SITE_ORIGIN}/healthz"; then
	ok "Live at ${SITE_ORIGIN} (${COMMIT})"
else
	warn "Running locally, but ${SITE_ORIGIN}/healthz is not reachable from here."
	warn "Check DNS, then: sudo systemctl status caddy; sudo journalctl -u caddy -n 50"
fi
