# GOAL:
Find - Share - Plan - Participate - and Talk alot about SUP tours and adventures out there on the waters.

# DEVELOP:
- Read [INSTRUCTIONS.md](./INSTRUCTIONS.md)

---

## Supabase: Local development and deployment

### Local-only workflow (Features)

1. **Start local Supabase** (Docker or Podman desktop required):
   ```bash
   npx supabase start
   ```

2. **Developing** 
Edit/generate migration files in `supabase/migrations/`, then:

   ```bash
   npm run reset    # Apply migrations + regenerate types
   npm run dev      # Run the app
   ```

3. **Create migrations** – After schema changes in Studio (local) or SQL locally:
   ```bash
   npx supabase migration new my_change
   # Edit the new file, then: npm run reset
   ```

### Deploy to remote Supabase (only to DEV db)

1. **Link your project** (once):
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```
   Get the project ref from the dashboard URL: `https://supabase.com/dashboard/project/<ref>`.

2. **Push migrations to remote**:
   ```bash
   npm run db:push
   ```

### Git branch workflow (optional)

- **`main`** – Production-ready migrations. Run `npm run db:push` from here to deploy.
- **`dev`** – Work-in-progress migrations. Use `npm run reset` locally to test before merging to `main`.

Git branches hold different migration sets, use on DEV DB - before merge and use on PROD.

---
Repo settings:
- Protected `main` (PR required, no direct pushes).
- Keep active development on `dev`.
- Tag stable releases from `main` (for example `v1.2.0`).

Codebase enviroments:
- `main`: production-ready state. Supabase:Prod db.
- `dev`: integration branch. Supabase:dev db.
- `feature/fix/*`: work branches. (local supabase)
