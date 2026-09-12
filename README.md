# GOAL:
Find - Share - Plan - Participate - and Talk alot about SUP tours and adventures out there on the waters.

# DEVELOP:
- Read [INSTRUCTIONS.md](./INSTRUCTIONS.md)
- Local Supabase, reset, types, login: [local-dev.md](./local-dev.md)

---

## Supabase: Local development and deployment

### Local-only workflow (Features)

1. **Start local Supabase** (Docker or Podman desktop required):
   ```bash
   npx supabase start
   ```

2. **Environment** — copy `.env.example` to `.env` and set:
   - `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` (from `npx supabase status`)
   - `SUPABASE_SERVICE_ROLE_KEY` — the **Secret** (service_role JWT). Required for `npm run reset`: it creates dev auth users via the Admin API (`scripts/seed-dev-test-user.mjs`), then loads `supabase/seed-data.sql`.

3. **Developing**  
   Edit/generate migration files in `supabase/migrations/`, then:

   ```bash
   npm run reset    # db reset + dev users + tour/blog seed + types
   npm run dev      # Run the app
   ```

   **Local-only logins** (after `npm run reset`): `admin@suptours.dk` / `password`, `test@suptour.dk` / `Husk1234`.

   If you only run `npx supabase db reset`, run `npm run seed:dev-user` then `npm run seed:dev-data` (or run `npm run reset` instead).

4. **Create migrations** – After schema changes in Studio (local) or SQL locally:
   ```bash
   npx supabase migration new my_change
   # Edit the new file, then: npm run reset
   ```

---

## Branches and environments

Three long-lived branches, each with a running environment:

| Branch | Environment | Database |
|---|---|---|
| `develop` *(default)* | your machine, `npm run dev` | local Docker Supabase |
| `staging` | https://staging.suptur.dk | its own Supabase on the VPS |
| `main` | https://suptur.dk | production Supabase on the VPS |

All work starts on `develop` — features, fixes, hotfixes, everything. Outside
contributions arrive as pull requests against `develop`.

`staging` and `main` are **promoted, never committed to**:

```powershell
cd local
.\Promote-Suptur.ps1 -To staging     # develop -> staging
.\Promote-Suptur.ps1 -To main        # staging -> main, and tags the release
```

Promotion is a fast-forward push, so afterwards all three branches point at the
same commit and there is never a merge to resolve. Promoting does not deploy —
that stays a separate, deliberate step:

```powershell
.\Deploy-Suptur.ps1 -Env staging
.\Deploy-Suptur.ps1 -Env production
```

Full detail — why the fast-forward matters, and how migrations behave across
three environments — is in [CLAUDE.md](./CLAUDE.md). Deployment, the VPS and
backups are in [deploy/README.md](./deploy/README.md). Security reports go
through [SECURITY.md](./SECURITY.md).

> **`npm run db:push` is legacy.** It targets a *linked hosted* Supabase
> project from before this repo moved to a self-hosted VPS. Migrations now
> reach staging and production through `deploy/scripts/deploy.sh`, which
> applies them to the VPS Postgres before swapping the new code in.
