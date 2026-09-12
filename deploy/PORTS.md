# Port registry

Every environment on this box gets its own loopback ports and its own systemd
units. Record new ones here before using them, so two never collide.

`provision.sh` also checks this for you: it compares every environment file
against every other and refuses to run if two share a name, root, domain or
port. This table is the human-readable version of that check.

| Port | Bound to | Service | Notes |
|------|----------|---------|-------|
| 80, 443 | `0.0.0.0` + `::` | Caddy | The only public listeners. All environments. |
| 22 | `0.0.0.0` + `::` | sshd | To be restricted to your home IP in the lockdown phase. |
| **3000** | `127.0.0.1` | **production** SvelteKit | `suptur.service` |
| **8000** | `127.0.0.1` | **production** Supabase gateway (Envoy) | Caddy forwards only `/rest`, `/auth`, `/storage`, `/realtime`. Studio lives here too and is deliberately **not** forwarded. |
| **5432** | `127.0.0.1` | **production** Postgres | Migrations, `psql`, `pg_dump`. |
| 6543 | — | production Supavisor | Declared, never started (`profiles: [unused]`). |
| **3001** | `127.0.0.1` | **staging** SvelteKit | `suptur-staging.service` |
| **8001** | `127.0.0.1` | **staging** Supabase gateway | Same forwarding rules. |
| **5433** | `127.0.0.1` | **staging** Postgres | |
| 6544 | — | staging Supavisor | Declared, never started. |
| 3002, 8002, 5434 | *(free)* | — | Suggested next environment or site. |

## Adding another environment

1. Pick the next free ports and add rows above.
2. Copy `deploy/environments/staging.env` to a new name and change `APP_NAME`,
   `PRIMARY_DOMAIN`, `API_HOST`, `DEPLOY_ROOT`, `GIT_BRANCH`, `REMOTE_CLONE`
   and every port. `provision.sh` will tell you if you miss one.
3. Clone the repo again on the VPS and `provision.sh --env <name>` from it.

Nothing else needs editing. The Caddy vhost, the systemd units, the sudoers
rule and the directory tree are all rendered from that one file.

Whether a new environment needs its own Supabase stack or can share one is a
real decision: a second full stack at production's memory ceilings is roughly
another 6 GB of *limits*. Staging avoids that with
`deploy/supabase/docker-compose.staging.yml`, which trims it to about 3 GB.

## The rule that matters

**Nothing a container publishes may bind to `0.0.0.0`.** Docker writes its own
iptables rules that bypass ufw, so a normally-published port is reachable from
the internet no matter what `ufw status` says. Caddy is the only public door.

Check it after any compose change:

```bash
ss -ltnp | grep -vE '127\.0\.0\.1|\[::1\]' 
```

Anything listed there other than `:80`, `:443` and `:22` is a mistake.
