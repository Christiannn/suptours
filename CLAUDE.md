# Working in this repository

Read `INSTRUCTIONS.md` for what the product is. This file is about how the
repository works.

## Three branches, three environments

| Branch | Runs on | Database | Who writes to it |
|---|---|---|---|
| `develop` *(default)* | your machine | local Docker Supabase | you, Claude, and merged PRs |
| `staging` | https://staging.suptur.dk | its own Supabase on the VPS | **nobody** — promoted from `develop` |
| `main` | https://suptur.dk | production Supabase on the VPS | **nobody** — promoted from `staging` |

All work starts on `develop`. Bug fixes, features, experiments, hotfixes — all
of it. There is no separate hotfix path.

### The one rule that keeps this simple

**Never commit to `staging` or `main`.** They are promoted, never merged into:

```powershell
cd local
.\Promote-Suptur.ps1 -To staging      # develop -> staging
.\Promote-Suptur.ps1 -To main         # staging -> main, and tags the release
```

That is a fast-forward push, so after promoting, all three branches point at
*literally the same commit*. This is what makes the model cheap: there is
never a merge to resolve, and the CI results from `develop` carry over because
the commit is identical.

Commit directly to `staging` or `main` and it stops working — that branch now
has a commit `develop` does not, the next promotion is no longer a
fast-forward, and it is refused. `Promote-Suptur.ps1` will tell you how to
merge it back down if it happens. Do that immediately; it only gets worse.

Promoting does **not** deploy. Deploying is a separate, deliberate step.

### Deploying

```powershell
.\Deploy-Suptur.ps1 -Env staging       # any ref is allowed here
.\Deploy-Suptur.ps1 -Env production    # makes you type suptur.dk first
```

`-Env` is mandatory everywhere. Production only accepts `main` or a `v*` tag
unless you pass `-ForceRef`.

## Local development

```bash
npm run supabase:start   # Docker Supabase on 127.0.0.1:54341
npm run reset            # migrations + seed data + dev users + regenerate types
npm run dev
```

`npm run reset` is free and non-destructive of anything that matters — reach
for it whenever local data gets into a strange state. Dev logins are in
`local-dev.md`.

## Migrations

Migrations are **append-only once they reach `staging`.**

While a migration exists only on `develop`, edit it freely — `npm run reset`
rebuilds from scratch. The moment it has run on staging it is recorded in
`supabase_migrations.schema_migrations`, and editing the file then means
staging and production disagree about the schema with nothing reporting it.
After that point, fix a migration by adding another one.

Two more things:

- New files must keep incrementing the numeric suffix
  (`.cursor/rules/supabase-migration-numbering.mdc` covers this).
- Migrations are applied **before** the code swap and are never rolled back
  with it, so a migration has to stay compatible with the release before it.
  Add a column before the code that writes to it, in two separate deploys.

If staging's schema gets into a mess, throw it away rather than repairing it:

```bash
ssh suptur 'cd ~/suptours-staging && deploy/scripts/reset-staging-db.sh --env staging'
```

Staging holds no real data — migrations plus `supabase/seed-data.sql` — which
is exactly what makes that safe.

## Things that will bite

- **`PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` are inlined into the
  browser bundle at build time.** Changing them needs a rebuild, not a restart.
  Everything in `src/lib/server/secrets.ts` is the opposite — read at runtime,
  so a restart is enough.
- **Each environment builds on the VPS**, because the anon key is generated
  there. That is why CI builds but never deploys.
- **`deploy/` scripts run from the clone's working tree**, while the app is
  built from `git archive <ref>`. So a change to a deploy script takes effect
  on staging when it reaches `staging`, and on production when it reaches
  `main` — not when you deploy a branch containing it.
- **`npm run lint` fails** on ~37 pre-existing errors. CI gates on
  `npm run check`, which is clean. Do not "fix" lint as a drive-by; it is its
  own piece of work.
- **`npm run db:push` is legacy** — it targets a linked hosted Supabase project
  that no longer exists in this architecture. Migrations reach the VPS through
  `deploy.sh`.

## Contributions from outside

Anyone can open a PR; nobody outside has write access. PRs target `develop` —
never `staging` or `main`. CI runs on fork PRs, which is safe because the
workflow uses no secrets at all (see the header of `.github/workflows/ci.yml`).

Dependabot targets `develop` too, grouped into one PR a week.

## Where things are

| | |
|---|---|
| Deployment, VPS, backups | `deploy/README.md` |
| Port registry | `deploy/PORTS.md` |
| Local dev (Danish) | `local-dev.md` |
| Product and design spec | `INSTRUCTIONS.md` |
| Operator scripts | `local/*.ps1` |
| Vulnerability reporting | `SECURITY.md` |
