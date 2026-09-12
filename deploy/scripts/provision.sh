#!/usr/bin/env bash
#
# Provisions (and re-provisions) the infrastructure for one site: the
# self-hosted Supabase stack, the Caddy vhost, and the systemd units.
#
# Safe to run repeatedly. The invariant that makes that true:
#
#   Secrets are minted on the first run and preserved verbatim on every run
#   after. Everything else is re-rendered from git.
#
# It does not build or deploy the app — that is deploy.sh — and it never
# touches volumes/db/data or volumes/storage.

source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

require_not_root
for cmd in docker openssl node rsync curl; do need_cmd "${cmd}"; done
docker compose version >/dev/null 2>&1 || die "docker compose v2 plugin is required"

SITE_ORIGIN="$(site_origin)"
SUPABASE_ORIGIN="$(supabase_origin)"

# --------------------------------------------------------------------------
# 0. Would this environment collide with another one?
#
# Two environments share this box. A copy-pasted environment file that still
# carries the other one's DEPLOY_ROOT or DB_PORT would not fail loudly — it
# would quietly point staging at production's Postgres. Cheap to check, so it
# is checked every time rather than trusted.
# --------------------------------------------------------------------------
log "Checking for collisions with the other environments"
for other_file in "${ENVIRONMENTS_DIR}"/*.env; do
	other_name="$(basename "${other_file}" .env)"
	[[ ${other_name} == "${DEPLOY_ENV}" ]] && continue
	for key in APP_NAME DEPLOY_ROOT PRIMARY_DOMAIN API_HOST APP_PORT API_PORT DB_PORT POOLER_PORT; do
		mine="${!key}"
		theirs="$(env_get "${other_file}" "${key}" | tr -d '"')"
		[[ -n ${theirs} && ${mine} == "${theirs}" ]] \
			&& die "${DEPLOY_ENV} and ${other_name} both use ${key}=${mine}.
     Two environments on one box must not share it. Fix ${other_file}
     or ${ENV_FILE} before provisioning."
	done
done
ok "No collisions with: $(cd "${ENVIRONMENTS_DIR}" && printf '%s ' *.env | sed "s/\.env//g; s/${DEPLOY_ENV} //")"

# --------------------------------------------------------------------------
# 1. Directories
# --------------------------------------------------------------------------
# /srv is root-owned, so the environment's own root is the one thing the deploy
# user cannot create for itself. This is the sudo prompt you get on a first
# provision; everything below it runs unprivileged.
if [[ ! -d ${DEPLOY_ROOT} ]]; then
	log "Creating ${DEPLOY_ROOT} (sudo)"
	sudo install -d -o "$(id -un)" -g "$(id -gn)" "${DEPLOY_ROOT}"
fi

log "Creating directory layout under ${DEPLOY_ROOT}"
mkdir -p \
	"${SUPABASE_DIR}/volumes/db/data" \
	"${SUPABASE_DIR}/volumes/storage" \
	"${RELEASES_DIR}" \
	"${APP_DIR}/shared" \
	"${BACKUP_DIR}" \
	"${STATE_DIR}"

# The marker that lets every other script in this clone work out its
# environment without being told. Gitignored: it belongs to the clone, not the
# branch.
printf '%s\n' "${DEPLOY_ENV}" > "${REPO_DIR}/.deploy-env"

# --------------------------------------------------------------------------
# 2. Operator secrets
# --------------------------------------------------------------------------
if [[ ! -f ${SECRETS_ENV} ]]; then
	log "Writing a blank ${SECRETS_ENV} for you to fill in"
	cat > "${SECRETS_ENV}" <<'EOF'
# Operator-supplied secrets. Never committed to git.
#
# SMTP is used for two things: Supabase password-reset mail, and the watchdog's
# downtime alerts. Until it is filled in, "forgot password" fails silently and
# alerts are logged but not sent.
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_ADMIN_EMAIL=
SMTP_SENDER_NAME=SUP Tours

# Where downtime warnings go.
ALERT_EMAIL=

# Optional dead-man's switch. The watchdog pings this on every successful
# check; if the pings stop — because the whole machine is gone — the service
# emails you. An on-box script cannot report its own host being dead, so this
# is the piece that covers total failure. https://healthchecks.io (free tier)
HEALTHCHECK_PING_URL=

# Social login. Register the redirect URI shown at the end of provisioning.
GOOGLE_CLIENT_ID=
GOOGLE_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_SECRET=

# Comma-separated list the APP uses to decide which buttons to render:
# google, facebook. Leave empty to hide them.
ENABLE_OAUTH=

# AI scraper (/admin/scraper). Deliberately empty: the feature reports itself
# as unconfigured rather than running. Adding keys here needs only a restart.
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
BRAVE_SEARCH_API_KEY=
EOF
	chmod 600 "${SECRETS_ENV}"
	warn "${SECRETS_ENV} is empty — mail and alerting stay disabled until you fill it in"
fi
chmod 600 "${SECRETS_ENV}"

# --------------------------------------------------------------------------
# 3. Sync the Supabase stack definition (never the data)
# --------------------------------------------------------------------------
log "Syncing Supabase stack definition from git"
rsync -a \
	--exclude 'volumes/db/data' \
	--exclude 'volumes/storage' \
	"${DEPLOY_DIR}/supabase/upstream/" "${SUPABASE_DIR}/"
cp "${DEPLOY_DIR}/supabase/docker-compose.override.yml" "${SUPABASE_DIR}/"
# Optional per-environment layer, applied third by compose(). Staging uses one
# to shrink the memory ceilings; production has none and takes the defaults.
if [[ -f ${DEPLOY_DIR}/supabase/docker-compose.${DEPLOY_ENV}.yml ]]; then
	cp "${DEPLOY_DIR}/supabase/docker-compose.${DEPLOY_ENV}.yml" "${SUPABASE_DIR}/"
	log "Applying the ${DEPLOY_ENV} compose layer"
fi
chmod +x "${SUPABASE_DIR}/volumes/api/envoy/docker-entrypoint.sh"

# --------------------------------------------------------------------------
# 4. Render the Supabase .env, minting secrets only when they are missing
# --------------------------------------------------------------------------
log "Rendering ${SUPABASE_DIR}/.env"

SUPABASE_ENV="${SUPABASE_DIR}/.env"
declare -A SECRETS=()

# Reuse whatever already exists. This is the whole idempotency story: rotating
# JWT_SECRET would invalidate every session and break the deployed browser
# bundle, which bakes in the anon key at build time.
carry_or_mint() {
	local key=$1 existing
	existing="$(env_get "${SUPABASE_ENV}" "${key}")"
	if [[ -n ${existing} ]]; then
		SECRETS[${key}]="${existing}"
		return 0
	fi
	return 1
}

carry_or_mint POSTGRES_PASSWORD            || SECRETS[POSTGRES_PASSWORD]="$(gen_hex 24)"
carry_or_mint JWT_SECRET                   || SECRETS[JWT_SECRET]="$(gen_hex 32)"
carry_or_mint SECRET_KEY_BASE              || SECRETS[SECRET_KEY_BASE]="$(gen_hex 32)"
carry_or_mint PG_META_CRYPTO_KEY           || SECRETS[PG_META_CRYPTO_KEY]="$(gen_hex 32)"
carry_or_mint S3_PROTOCOL_ACCESS_KEY_ID    || SECRETS[S3_PROTOCOL_ACCESS_KEY_ID]="$(gen_hex 16)"
carry_or_mint S3_PROTOCOL_ACCESS_KEY_SECRET || SECRETS[S3_PROTOCOL_ACCESS_KEY_SECRET]="$(gen_hex 32)"
carry_or_mint DASHBOARD_PASSWORD           || SECRETS[DASHBOARD_PASSWORD]="$(gen_hex 16)"
carry_or_mint DASHBOARD_USERNAME           || SECRETS[DASHBOARD_USERNAME]="supabase"
# Length-sensitive: Vault wants exactly 32 chars, Realtime's AES key exactly 16.
carry_or_mint VAULT_ENC_KEY                || SECRETS[VAULT_ENC_KEY]="$(gen_hex 16)"
carry_or_mint REALTIME_DB_ENC_KEY          || SECRETS[REALTIME_DB_ENC_KEY]="$(gen_hex 8)"

# The API keys are signatures over JWT_SECRET, so they must be minted after it
# is settled — and re-minted if it ever changes.
carry_or_mint ANON_KEY \
	|| SECRETS[ANON_KEY]="$(node "${DEPLOY_DIR}/scripts/mint-jwt.mjs" "${SECRETS[JWT_SECRET]}" anon)"
carry_or_mint SERVICE_ROLE_KEY \
	|| SECRETS[SERVICE_ROLE_KEY]="$(node "${DEPLOY_DIR}/scripts/mint-jwt.mjs" "${SECRETS[JWT_SECRET]}" service_role)"

# Operator-supplied values feed the template too.
set -a
# shellcheck source=/dev/null
source "${SECRETS_ENV}"
set +a

# Staging has no www host, so adding one here would put a redirect target in
# GoTrue's allow-list for a name that does not resolve.
ADDITIONAL_REDIRECT_URLS="${SITE_ORIGIN}/**"
if [[ ${REDIRECT_DOMAINS} == *"www.${PRIMARY_DOMAIN}"* ]]; then
	ADDITIONAL_REDIRECT_URLS="${ADDITIONAL_REDIRECT_URLS},https://www.${PRIMARY_DOMAIN}/**"
fi

SECRETS_JSON="$(
	for key in "${!SECRETS[@]}"; do
		printf '%s\t%s\n' "${key}" "${SECRETS[${key}]}"
	done
)"

SECRETS_TSV="${SECRETS_JSON}" \
SITE_URL="${SITE_ORIGIN}" \
API_EXTERNAL_URL="${SUPABASE_ORIGIN}" \
ADDITIONAL_REDIRECT_URLS="${ADDITIONAL_REDIRECT_URLS}" \
APP_NAME="${APP_NAME}" \
API_PORT="${API_PORT}" \
DB_PORT="${DB_PORT}" \
POOLER_PORT="${POOLER_PORT}" \
python3 - "${DEPLOY_DIR}/supabase/env.template" "${SUPABASE_ENV}" <<'PY'
import os, sys

template_path, out_path = sys.argv[1], sys.argv[2]
text = open(template_path).read()

for line in os.environ["SECRETS_TSV"].splitlines():
    if not line.strip():
        continue
    key, value = line.split("\t", 1)
    text = text.replace(f"@@GENERATED:{key}@@", value)

for key in (
    "SITE_URL", "API_EXTERNAL_URL", "ADDITIONAL_REDIRECT_URLS",
    "APP_NAME", "API_PORT", "DB_PORT", "POOLER_PORT",
    "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS",
    "SMTP_ADMIN_EMAIL", "SMTP_SENDER_NAME",
):
    text = text.replace(f"@@{key}@@", os.environ.get(key, ""))

# Providers are on only when both a client id and a secret are present.
for provider in ("GOOGLE", "FACEBOOK"):
    configured = bool(os.environ.get(f"{provider}_CLIENT_ID")) and bool(
        os.environ.get(f"{provider}_SECRET")
    )
    text = text.replace(f"{provider}_ENABLED=false", f"{provider}_ENABLED={str(configured).lower()}")
    text = text.replace(
        f"{provider}_CLIENT_ID=\n", f"{provider}_CLIENT_ID={os.environ.get(f'{provider}_CLIENT_ID', '')}\n"
    )
    text = text.replace(
        f"{provider}_SECRET=\n", f"{provider}_SECRET={os.environ.get(f'{provider}_SECRET', '')}\n"
    )

leftover = [l for l in text.splitlines() if "@@" in l and not l.lstrip().startswith("#")]
if leftover:
    sys.exit("unsubstituted tokens remain:\n  " + "\n  ".join(leftover))

open(out_path, "w").write(text)
PY

chmod 600 "${SUPABASE_ENV}"
ok "Supabase .env rendered (secrets preserved: $([[ -n $(env_get "${SUPABASE_ENV}" ANON_KEY) ]] && echo yes || echo no))"

# --------------------------------------------------------------------------
# 5. Runtime env for the SvelteKit server
# --------------------------------------------------------------------------
log "Rendering ${SHARED_ENV}"
{
	echo "# Generated by provision.sh — edit ${SECRETS_ENV} instead."
	echo "NODE_ENV=production"
	echo "PORT=${APP_PORT}"
	echo "HOST=127.0.0.1"
	# Without ORIGIN, SvelteKit's CSRF check rejects every POST behind a proxy
	# and OAuth redirectTo is built from the wrong host.
	echo "ORIGIN=${SITE_ORIGIN}"
	echo "ADDRESS_HEADER=x-forwarded-for"
	echo "XFF_DEPTH=1"
	echo "BODY_SIZE_LIMIT=52428800"
	echo "ENABLE_OAUTH=${ENABLE_OAUTH:-}"
	echo "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}"
	echo "GEMINI_API_KEY=${GEMINI_API_KEY:-}"
	echo "BRAVE_SEARCH_API_KEY=${BRAVE_SEARCH_API_KEY:-}"
} > "${SHARED_ENV}"
chmod 600 "${SHARED_ENV}"

# --------------------------------------------------------------------------
# 5b. Basic-auth credentials for environments that want a password in front
# --------------------------------------------------------------------------
# Minted here rather than typed in, and carried forward on every re-provision
# for the same reason the Supabase secrets are: a password that silently
# changes under you is worse than no password. Only the bcrypt hash reaches
# Caddy; the plaintext is shown once, here, and then only lives in your
# password manager.
if is_enabled BASIC_AUTH; then
	BASIC_AUTH_FILE="${DEPLOY_ROOT}/basic-auth.env"
	if [[ ! -f ${BASIC_AUTH_FILE} ]]; then
		need_cmd caddy
		plain="$(gen_hex 12)"
		hash="$(caddy hash-password --plaintext "${plain}")"
		{
			echo "# Generated by provision.sh. Delete this file and re-provision to rotate."
			echo "BASIC_AUTH_USER=${DEPLOY_ENV}"
			echo "BASIC_AUTH_HASH=${hash}"
		} > "${BASIC_AUTH_FILE}"
		chmod 600 "${BASIC_AUTH_FILE}"
		cat <<-EOF

		    ${PRIMARY_DOMAIN} is password-protected. Save these now — the
		    plaintext is not stored anywhere and is not shown again:

		      user      ${DEPLOY_ENV}
		      password  ${plain}

		EOF
	else
		ok "Basic-auth credentials preserved (${BASIC_AUTH_FILE})"
	fi
fi

# --------------------------------------------------------------------------
# 6. Start Supabase
# --------------------------------------------------------------------------
log "Starting the Supabase stack (this pulls images on first run)"
compose up -d --remove-orphans

log "Waiting for the API gateway"
wait_for_http "http://127.0.0.1:${API_PORT}/auth/v1/health" 60 3 \
	|| die "Supabase gateway did not become healthy — check: docker compose logs"
ok "Supabase is up"

# pg_stat_statements is preloaded by the Supabase image but the extension still
# has to be created. maintenance.sh reports slow queries from it.
compose exec -T db psql -U postgres -d postgres \
	-c 'CREATE EXTENSION IF NOT EXISTS pg_stat_statements;' >/dev/null
ok "pg_stat_statements ready"

# --------------------------------------------------------------------------
# 7. systemd + Caddy (need root)
# --------------------------------------------------------------------------
log "Installing systemd units and the Caddy vhost (sudo)"
sudo "${DEPLOY_DIR}/scripts/install-system-units.sh" --env "${DEPLOY_ENV}"

cat <<EOF

$(ok "Provisioning complete")

  Site            ${SITE_ORIGIN}
  Supabase API    ${SUPABASE_ORIGIN}
  Studio          not public — tunnel with local/Open-Studio.ps1, then
                  http://localhost:${API_PORT} (user: $(env_get "${SUPABASE_ENV}" DASHBOARD_USERNAME))
  OAuth redirect  ${SUPABASE_ORIGIN}/auth/v1/callback

Next: deploy/scripts/deploy.sh
EOF
