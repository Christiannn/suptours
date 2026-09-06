# Port registry

Every site on this box gets its own loopback port and its own systemd unit.
Record new ones here before using them, so two sites never collide.

| Port | Bound to | Service | Notes |
|------|----------|---------|-------|
| 80, 443 | `0.0.0.0` + `::` | Caddy | The only public listeners. All sites. |
| 22 | `0.0.0.0` + `::` | sshd | To be restricted to your home IP in the lockdown phase. |
| 3000 | `127.0.0.1` | suptur.dk SvelteKit | `suptur.service` |
| 8000 | `127.0.0.1` | Supabase gateway (Envoy) | Caddy forwards only `/rest`, `/auth`, `/storage`, `/realtime`. Studio lives here too and is deliberately **not** forwarded. |
| 5432 | `127.0.0.1` | Postgres | Migrations, `psql`, `pg_dump`. |
| 3001 | *(free)* | — | Suggested next site. |

## Adding a second site

1. Pick the next free port and add a row above.
2. `deploy/config.env` → a copy with the new `APP_NAME`, `PRIMARY_DOMAIN`, `APP_PORT`.
3. Drop a new file in `/etc/caddy/sites.d/<domain>.caddy` — Caddy imports the
   whole directory, so nothing else changes.
4. Add a systemd unit from the same template.

Whether the new site needs its own Supabase stack or can share this one is a
real decision: a second full stack is roughly another 1.5–2 GB of RAM.

## The rule that matters

**Nothing a container publishes may bind to `0.0.0.0`.** Docker writes its own
iptables rules that bypass ufw, so a normally-published port is reachable from
the internet no matter what `ufw status` says. Caddy is the only public door.
