# Deploying suptur.dk

Self-hosted SvelteKit + Supabase on one VPS, running two independent
environments — production and staging — with room for more.

    Ubuntu 26.04 · 4 vCPU · 8 GB · 200 GB
    85.190.105.95 · 2001:880:a:321::28d · user: administrator

Everything here is safe to run more than once. Re-running rebuilds the
deployment; it never deletes the database or uploaded files.

Every script takes `--env production` or `--env staging` and **refuses to
guess**. Guessing is how a staging provision ends up pointed at the live
database.

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
       ├─ api.suptur.dk                     → 127.0.0.1:8000   Supabase
       │
       ├─ staging.suptur.dk                 → 127.0.0.1:3001   SvelteKit
       │     (basic_auth + noindex; /healthz deliberately exempt)
       └─ api-staging.suptur.dk             → 127.0.0.1:8001   Supabase

  Only /rest /auth /storage /realtime are forwarded on either API host.
  Studio is served by the same gateway and is NOT forwarded — tunnel to it.

  Two full Docker stacks, every port bound to 127.0.0.1:
    production  api-gw:8000 · db:5432 · auth · rest · realtime · storage · …
    staging     api-gw:8001 · db:5433 · (same, at a third of the memory)
```

The two share the machine, Caddy and the Docker daemon. They share nothing
else: separate containers (Compose project names `suptur` and
`suptur-staging`), separate Postgres, separate secrets, separate systemd units,
separate release directories.

```
/srv/suptur/                      and  /srv/suptur-staging/
├── app/
│   ├── releases/<stamp>-<sha>/   build + node_modules (newest 5 / 3 kept)
│   ├── current -> releases/…     atomic symlink; the live release
│   └── shared/.env               runtime env, 0600
├── supabase/
│   ├── .env                      generated once, 0600  ← the crown jewels
│   └── volumes/                  Postgres data + storage objects  ← never deleted
├── backups/                      production only; staging sets ENABLE_BACKUPS=0
├── state/                        watchdog alert state
├── basic-auth.env                staging only: generated, 0600
├── deploy.lock                   held for the duration of a deploy
└── secrets.env                   yours: SMTP, alert email  ← fill this in
```

And two clones of this repository, each marked with its own `.deploy-env`:

```
~/suptours           checked out on main      → production
~/suptours-staging   checked out on staging   → staging
```

That separation is deliberate. The deploy *scripts* run from the clone's
working tree while the app is built from `git archive <ref>`, so staging
exercises a change to the deploy machinery itself before production ever sees
it.

---

## First-time setup

### 1. DNS — do this first

Certificates are issued over HTTP-01, so the names must resolve to the VPS
before you provision. Allow 15–60 minutes to propagate.

| Type | Name | Value |
|---|---|---|
| A | `@`, `www`, `api`, `staging`, `api-staging` | `85.190.105.95` |
| AAAA | `@`, `www`, `api`, `staging`, `api-staging` | `2001:880:a:321::28d` |
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
Resolve-DnsName suptur.dk, www.suptur.dk, api.suptur.dk, staging.suptur.dk, api-staging.suptur.dk
```

### 2. SSH key

```powershell
cd local
.\Setup-SshKey.ps1
```

Generates a key, installs it, and adds a `suptur` host alias. It verifies key
login works before finishing — if it doesn't, stop and fix that first.

### 3. Bootstrap the box

```bash
ssh suptur
git clone https://github.com/Christiannn/suptours.git ~/suptours
cd ~/suptours
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
cd ~/suptours
deploy/scripts/provision.sh --env production   # writes the blank secrets.env
nano /srv/suptur/secrets.env
deploy/scripts/provision.sh --env production   # picks up what you filled in
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
.\Deploy-Suptur.ps1 -Env production
```

### 7. Stand up staging

Once production is running, staging is one more clone and one more provision.
Nothing about it touches production — different root, different ports,
different Compose project, different units.

```bash
ssh suptur
git clone https://github.com/Christiannn/suptours.git ~/suptours-staging
cd ~/suptours-staging
git checkout staging
deploy/scripts/provision.sh --env staging
```

Provisioning prints the generated basic-auth password **once**. Save it then —
it is not stored anywhere in plaintext. (Lost it? Delete
`/srv/suptur-staging/basic-auth.env` and re-provision to mint a new one.)

Then, from your PC:

```powershell
.\Deploy-Suptur.ps1 -Env staging
```

Before trusting it, confirm production was not disturbed:

```bash
ssh suptur 'systemctl status suptur --no-pager | head -5; ls -la /etc/systemd/system/suptur*'
curl -sSI https://suptur.dk/healthz | head -1
```

---

## Day to day

`-Env` is mandatory on everything that can change something.

| | |
|---|---|
| Promote `develop` → `staging` | `.\Promote-Suptur.ps1 -To staging` |
| Promote `staging` → `main` | `.\Promote-Suptur.ps1 -To main` |
| Deploy staging | `.\Deploy-Suptur.ps1 -Env staging` |
| Deploy a branch to staging | `.\Deploy-Suptur.ps1 -Env staging -Ref feature/x` |
| Deploy production | `.\Deploy-Suptur.ps1 -Env production` (makes you type the domain) |
| See what would deploy | `.\Deploy-Suptur.ps1 -Env staging -DryRun` |
| Roll back | `ssh suptur 'cd ~/suptours && deploy/scripts/rollback.sh --env production'` |
| Supabase Studio | `.\Open-Studio.ps1 -Env staging` |
| Back up now | `.\Invoke-Backup.ps1 -Env production -Download` |
| Prove a backup restores | `.\Invoke-Backup.ps1 -Env production -Verify` |
| Wipe and reseed staging's DB | `ssh suptur 'cd ~/suptours-staging && deploy/scripts/reset-staging-db.sh --env staging'` |
| App logs | `ssh suptur 'journalctl -u suptur -f'` (or `suptur-staging`) |
| Supabase logs | `ssh suptur 'cd /srv/suptur/supabase && docker compose -p suptur logs -f auth'` |
| Container status | `ssh suptur 'docker ps --format "table {{.Names}}\t{{.Status}}"'` |

Note the `-p` on the Compose commands. Without it Compose names the project
after the directory — `supabase` for both environments — and you would be
looking at, or restarting, the wrong stack.

### Reclaiming memory

Staging is sized to coexist with production (about 3 GB of ceilings against
production's 6.6 GB), but if the box gets tight you can simply stop it. Its
data survives; deploys are manual anyway.

```bash
ssh suptur 'cd /srv/suptur-staging/supabase && docker compose -p suptur-staging stop'
ssh suptur 'sudo systemctl stop suptur-staging'
```

Bring it back with `docker compose -p suptur-staging start` and a deploy.

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

0. **Backups never leave the box.** `backup.sh` writes to `/srv/suptur/backups`
   and nothing copies them off, so the one failure that would actually destroy
   the site — losing the machine — takes the backups with it. Until an off-box
   copy exists this is the biggest hole in the setup. Fix it by registering
   `Invoke-Backup.ps1 -Env production -Download -Yes` as a weekly Windows
   Scheduled Task, or by pointing rclone at object storage. And run
   `verify-backup.sh` occasionally: a backup nobody has restored is a
   hypothesis, not a backup.

1. **No SMTP until you configure it.** Signup works (`config.toml` has
   `enable_confirmations = false`), but password reset fails silently.
   Leave staging's SMTP blank — staging has no real users, and an SMTP-enabled
   staging is how test activity ends up emailing real addresses.
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
