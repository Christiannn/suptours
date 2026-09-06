# Vendored Supabase stack

`upstream/` is a verbatim copy of the self-hosted Supabase stack, pinned to:

    repository  https://github.com/supabase/supabase
    commit      bd43802d7b4daa777d55f3b9b01e9062c7988dc0
    path        docker/

Vendored rather than fetched at provision time so that re-running `provision.sh`
a year from now produces the same stack, and so the whole thing is reviewable in
a diff. Nothing in `upstream/` is edited — every change we make lives in
`../docker-compose.override.yml`, which keeps upgrades to "re-fetch and re-read
one short file".

## Pinned image versions

| Service | Image |
|---|---|
| db | `supabase/postgres:17.6.1.136` — matches `major_version = 17` in `supabase/config.toml` |
| api-gw | `envoyproxy/envoy:v1.39.0` |
| auth | `supabase/gotrue:v2.189.0` |
| rest | `postgrest/postgrest:v14.12` |
| realtime | `supabase/realtime:v2.102.3` |
| storage | `supabase/storage-api:v1.60.4` |
| imgproxy | `darthsim/imgproxy:v3.30.1` |
| meta | `supabase/postgres-meta:v0.96.6` |
| studio | `supabase/studio:2026.08.03-sha-022b374` |

## What we changed

See `../docker-compose.override.yml` for the reasoning. In short:

- Everything published binds to `127.0.0.1`, never `0.0.0.0`.
- `functions` (edge runtime) and `supavisor` (pooler) are parked behind an
  `unused` profile: this repo has no `supabase/functions/`, and the app reaches
  Postgres over HTTP through PostgREST rather than directly.
- Postgres is tuned for 8 GB shared with other services.
- Facebook OAuth env is added — upstream wires up Google, GitHub and Azure only,
  but the login page offers Facebook.
- Memory limits on every service.

## Upgrading

```bash
SHA=<new commit sha>
cd deploy/supabase
curl -fsSL -o upstream/docker-compose.yml \
  "https://raw.githubusercontent.com/supabase/supabase/${SHA}/docker/docker-compose.yml"
for f in $(cd upstream && find volumes -type f ! -name .gitkeep); do
  curl -fsSL -o "upstream/$f" \
    "https://raw.githubusercontent.com/supabase/supabase/${SHA}/docker/$f"
done
```

Then re-read `docker-compose.override.yml` against the new file — particularly
whether any service was renamed or gained a `depends_on` — update the SHA above,
and check the merge before deploying:

```bash
docker compose -f upstream/docker-compose.yml -f docker-compose.override.yml \
  --env-file /srv/suptur/supabase/.env config --services
```

**Take a backup first.** A major Postgres version bump needs a dump-and-restore,
not a container swap.
