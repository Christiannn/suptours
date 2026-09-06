# Deploying suptur.dk

Self-hosted SvelteKit + Supabase on one VPS, with room for more sites later.

    Ubuntu 26.04 · 4 vCPU · 8 GB · 200 GB
    85.190.105.95 · 2001:880:a:321::28d · user: administrator

Everything here is safe to run more than once. Re-running rebuilds the
deployment; it never deletes the database or uploaded files.

---

## How it fits together

```
              Internet
                 │
  :80/:443 ──────┼────── :22  sshd (key-only)
       ▼
     Caddy ── automatic HTTPS, one file per site
       │
       ├─ suptur.dk                         → 127.0.0.1:3000   SvelteKit
       ├─ www.suptur.dk, suptours.dk, www.  → 301 → suptur.dk
       └─ api.suptur.dk                     → 127.0.0.1:8000   Supabase
             (only /rest /auth /storage /realtime — Studio is NOT forwarded)

  Docker, all bound to 127.0.0.1:
    api-gw:8000 · auth · rest · realtime · storage · imgproxy · meta · studio · db:5432
```

```
/srv/suptur/
├── app/
│   ├── releases/<stamp>-<sha>/   build + node_modules (newest 5 kept)
│   ├── current -> releases/…     atomic symlink; the live release
│   └── shared/.env               runtime env, 0600
├── supabase/
│   ├── .env                      generated once, 0600  ← the crown jewels
│   └── volumes/                  Postgres data + storage objects  ← never deleted
├── backups/                      nightly + pre-deploy, 14 days
├── state/                        watchdog alert state
└── secrets.env                   yours: SMTP, alert email  ← fill this in
```

---

## First-time setup

### 1. DNS — do this first

Certificates are issued over HTTP-01, so the names must resolve to the VPS
before you provision. Allow 15–60 minutes to propagate.

| Type | Name | Value |
|---|---|---|
| A | `@`, `www`, `api` | `85.190.105.95` |
| AAAA | `@`, `www`, `api` | `2001:880:a:321::28d` |
| CAA | `@` | `0 issue "letsencrypt.org"` |
| TXT | `@` | `v=spf1 -all` |
| TXT | `_dmarc` | `v=DMARC1; p=reject;` |

Add the same A/AAAA pair for `suptours.dk` and `www.suptours.dk` — they must
resolve for the redirect to work and for Caddy to get certificates for them.

The CAA record stops any CA other than Let's Encrypt issuing for your domain.
The two TXT records stop anyone spoofing mail from it while you send none;
once SMTP is live, replace the SPF record with your provider's include.

Check from your PC:

```powershell
Resolve-DnsName suptur.dk, www.suptur.dk, api.suptur.dk
```

### 2. SSH key

```powershell
cd local
.\Setup-SshKey.ps1
```

Generates a key, installs it, and adds a `suptur` host alias. It verifies key
login works before finishing — if it doesn't, stop and fix that first.

### 3. Bootstrap the box

The clone location must match `VPS_REPO_DIR` in `deploy/config.env` — that is
what the PowerShell wrappers cd into.

```bash
ssh suptur
git clone https://github.com/Christiannn/suptours.git ~/suptur
cd ~/suptur
sudo deploy/bootstrap/01-bootstrap.sh
exit          # docker group membership only applies to a new login
```

Installs Docker, Node 22, Caddy, fail2ban, unattended security upgrades, a 4 GB
swapfile, and Docker log-size caps. Web and SSH are both open at this stage.

### 4. Key-only SSH

Read `deploy/bootstrap/02-ssh-keys.sh` before running it — it is the one step
that can lock you out, which is why it refuses to run unless your key is
already installed.

```bash
ssh suptur
sudo deploy/bootstrap/02-ssh-keys.sh
```

**Keep that session open.** In a second terminal, confirm both:

```powershell
ssh suptur                                        # logs in
ssh -o PreferredAuthentications=password suptur   # REFUSED
```

Only then close the first one. If something goes wrong, your provider's web
console can always delete `/etc/ssh/sshd_config.d/99-hardening.conf`.

### 5. Fill in your secrets

The first provision writes a blank `/srv/suptur/secrets.env`. Run it once to
generate the file, fill it in, then run it again:

```bash
ssh suptur
cd ~/suptur
deploy/scripts/provision.sh        # writes the blank secrets.env
nano /srv/suptur/secrets.env
deploy/scripts/provision.sh        # picks up what you filled in
```

What goes in it:

- **SMTP** — an account from Resend, Brevo or Postmark. One account covers two
  things: Supabase's password-reset mail, and the watchdog's downtime alerts.
  Until it is set, "forgot password" fails silently and alerts only reach the
  journal.
- **ALERT_EMAIL** — where downtime warnings go.
- **HEALTHCHECK_PING_URL** — a free https://healthchecks.io check. The watchdog
  pings it on every healthy run. This is the piece that covers the whole
  machine dying, which an on-box script cannot report itself.
- **ENABLE_OAUTH** — leave empty. The Google/Facebook buttons stay hidden until
  you register the apps.

Re-running `provision.sh` never regenerates the Supabase secrets. That matters:
`PUBLIC_SUPABASE_ANON_KEY` is compiled into the browser bundle at build time,
so rotating `JWT_SECRET` would invalidate every session *and* break the
deployed client until the next build.

### 6. Deploy

```powershell
cd local
.\Deploy-Suptur.ps1
```

---

## Day to day

| | |
|---|---|
| Deploy `main` | `.\Deploy-Suptur.ps1` |
| Deploy a branch | `.\Deploy-Suptur.ps1 -Ref development` |
| See what would deploy | `.\Deploy-Suptur.ps1 -DryRun` |
| Roll back | `ssh suptur 'deploy/scripts/rollback.sh'` |
| Supabase Studio | `.\Open-Studio.ps1` |
| Back up now | `.\Invoke-Backup.ps1` (`-Download` to fetch it) |
| App logs | `ssh suptur 'journalctl -u suptur -f'` |
| Supabase logs | `ssh suptur 'cd /srv/suptur/supabase && docker compose logs -f auth'` |
| Container status | `ssh suptur 'cd /srv/suptur/supabase && docker compose ps'` |

### What a deploy does

1. Backs up the database and storage.
2. Fetches the ref and builds it in a **new** release directory.
3. Applies migrations — forward-only, seeds never.
4. Swaps the `current` symlink atomically and restarts.
5. Health-checks `/healthz`; **on failure, relinks the previous release and
   restarts it.**
6. Prunes to the newest 5 releases.

Steps 2–3 happen off to the side, so a failed build cannot take the site down.

Schema changes are *not* rolled back with the code, so a migration has to stay
compatible with the release before it.

---

## Automatic upkeep

| Unit | When | Does |
|---|---|---|
| `suptur-watchdog.timer` | every 2 min | `/healthz`, container health, disk, memory |
| `suptur-backup.timer` | 03:30 | `pg_dump` + storage tarball, 14-day retention |
| `suptur-maintenance.timer` | 04:20 | journal → 24h, Caddy logs → 24h, Docker image/cache prune, release + backup pruning, weekly `VACUUM ANALYZE`, slow-query report |

The watchdog tells two failures apart, because the right response differs:

- **Not answering at all** → restarts the app once, then emails if it is still down.
- **Answering with 503** → the database is the problem; restarting the app would
  only add downtime, so it just emails.

It emails **only when the state changes**, not every two minutes. A watchdog
that spams during an outage gets muted, and then the next outage goes unnoticed.

Neither `docker volume prune` nor `docker compose down -v` appears anywhere in
these scripts — either would take the Postgres data directory with it.
`lib/common.sh` refuses `-v` outright.

---

## Restoring from a backup

```bash
ssh suptur
cd /srv/suptur/supabase
ls -lh /srv/suptur/backups

gunzip -c /srv/suptur/backups/<stamp>-db.sql.gz \
  | docker compose exec -T db psql -U postgres -d postgres

tar -xzf /srv/suptur/backups/<stamp>-storage.tar.gz -C /srv/suptur/supabase/volumes
docker compose restart storage
```

---

## Known gaps

1. **No SMTP until you configure it.** Signup works (`config.toml` has
   `enable_confirmations = false`), but password reset fails silently.
2. **Google/Facebook login is off.** The buttons only render when `ENABLE_OAUTH`
   lists a provider *and* the credentials are in `secrets.env`. Register
   `https://api.suptur.dk/auth/v1/callback` with the provider first.
3. **The AI scraper is deliberately unconfigured.** `/admin/scraper` reports
   itself as unavailable. Adding keys to `secrets.env` and re-provisioning turns
   it on — a restart, not a rebuild, since they are read at runtime.
4. **Rate limiting is per-process.** `src/lib/server/rateLimitIp.ts` is an
   in-memory `Map`. Correct for the single Node process we run; it would
   silently stop working across several. Scaling out means moving it into
   Postgres first.
5. **`npm run lint` fails on pre-existing issues** — 37 eslint errors and an
   unformatted tree, both from before this work. `npm run check` is clean
   (0 errors) as long as the `PUBLIC_SUPABASE_*` vars are set, which is why the
   CI workflow gates on `check` and not `lint`.
6. **SSH is not yet IP-restricted.** Deliberate — that is the lockdown phase,
   after the site is proven. See below.

---

## Still to come: the lockdown phase

Once the site has been running happily:

1. Install Tailscale on the VPS and your PC — the escape hatch, so a changing
   home IP can never lock you out.
2. `ufw allow in on tailscale0`, then replace the blanket `allow 22` with
   `allow from <your-home-ip> to any port 22`.
3. Leave 80 and 443 open to the world. **The firewall only ever restricts SSH** —
   every site stays publicly reachable on both IPv4 and IPv6.
