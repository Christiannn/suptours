# GOAL:
A Svelte 5 + SvelteKit + Supabase - Template APP for forking/copying into new custom websites.

# DEVELOP:
- Read [INSTRUCTIONS.md](./INSTRUCTIONS.md)

---

## Supabase: Local development and deployment

### Local-only workflow

1. **Start local Supabase** (Docker required):
   ```bash
   npx supabase start
   ```

2. **Develop** – Edit migrations in `supabase/migrations/`, then:
   ```bash
   npm run reset    # Apply migrations + regenerate types
   npm run dev      # Run the app
   ```

3. **Create migrations** – After schema changes in Studio or SQL:
   ```bash
   npx supabase migration new my_change
   # Edit the new file, then: npm run reset
   ```

### Deploy to remote Supabase

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

Supabase branching (preview branches via GitHub) is for remote instances, not local dev/prod. Locally you use one database; Git branches hold different migration sets.

---

## Git relationship: `base-app` and `customer-a-site`

This section defines a stable long-term relationship between your shared product core (`base-app`) and each customer project (`customer-a-site`).

### Recommended model (best practice for your scenario)

- `base-app` is the source of truth for reusable features, fixes, and architecture.
- `customer-a-site` is its own repo for branding, customer-specific flows, and integrations.
- In customer repos, `origin` points to the customer repo and `upstream` points to `base-app`.
- Sync from `base-app` regularly in small batches (weekly or per release), not in big jumps.
- Use pull requests for every sync to keep history clear and conflict resolution documented.

### Why this model works

- Keeps customer delivery independent, while still receiving base improvements.
- Avoids risky copy-paste updates.
- Preserves clean ownership: generic logic in base, custom logic in customer repos.
- Makes AI/agent automation safer by using explicit remotes and repeatable command recipes.

---

## Repository setup recipes

### Recipe A - Publish `base-app` (first time)

Use when this local folder is not connected to GitHub yet.

```bash
git init
git add .
git commit -m "Initial SSB base app"
git branch -M main
git remote add origin https://github.com/<your-user-or-org>/base-app.git
git push -u origin main
git checkout -b dev
git push -u origin dev
```

Recommended repo settings:
- Protect `main` (PR required, no direct pushes).
- Keep active development on `dev`.
- Tag stable releases from `main` (for example `v1.2.0`).

### Recipe B - Create `customer-a-site` from `base-app`

Preferred order:
1. Mark `base-app` as a GitHub Template repository.
2. Create `customer-a-site` from template.
3. Clone and add `upstream`:

```bash
git clone https://github.com/<your-user-or-org>/customer-a-site.git
cd customer-a-site
git remote add upstream https://github.com/<your-user-or-org>/base-app.git
git fetch upstream --tags
git checkout -b dev
git push -u origin dev
```

---

## Ongoing branch strategy

Use the same branch names across repos for predictability:

- `main`: production-ready state.
- `dev`: integration branch.
- `feature/*`: normal work branches.
- `sync/base-vX-Y-Z`: branches used only for base-to-customer sync updates.

### Commit ownership rule

- If change is reusable for all customers -> commit in `base-app` first.
- If change is only for one customer -> commit only in that customer repo.

---

## Sync recipes (base -> customer)

### Recipe C - Regular sync from base `main`

Run this in `customer-a-site`:

```bash
git checkout dev
git pull origin dev
git fetch upstream --tags
git checkout -b sync/base-latest
git merge upstream/main
# resolve conflicts
npm install
npm run check
npm run test
git push -u origin sync/base-latest
```

Then open PR: `sync/base-latest` -> `dev`, review, merge, and deploy through your normal flow.

### Recipe D - Sync by release tag (safer for production teams)

Prefer this when base uses version tags:

```bash
git fetch upstream --tags
git checkout dev
git pull origin dev
git checkout -b sync/base-v1.2.0
git merge v1.2.0
# or: git merge upstream/main if tag points to main head
npm run check
npm run test
git push -u origin sync/base-v1.2.0
```

This makes change windows explicit and easier to rollback/audit.

---

## Conflict minimization guidelines

- Keep customer customizations in clearly named areas (for example `src/lib/customer/` and `src/routes/(customer)/`).
- Avoid editing base-like shared components in customer repos unless absolutely necessary.
- Prefer extension points (props, slots, hooks, config files) over hard forks of core files.
- Sync frequently and in small increments.
- When a customer fix could help everyone, backport it to `base-app`.

---

## Agent-friendly workflow recipe

Use this as a safe checklist for AI agents operating in `customer-a-site`:

1. Verify remotes before any sync:
   - `origin` must be `customer-a-site`.
   - `upstream` must be `base-app`.
2. Never force-push shared branches (`main`, `dev`).
3. Create a dedicated sync branch (`sync/base-*`) for every sync action.
4. Merge from `upstream/main` or a specific upstream tag.
5. Run project validation (`npm run check`, tests, and build if available).
6. Open PR with a summary:
   - What came from base.
   - Conflict files and chosen resolution.
   - Test/build results.
7. Only merge after review and green checks.

### PR template snippet for sync work

```md
## Purpose
Sync `base-app` updates into `customer-a-site`.

## Source
- Upstream ref: `<upstream/main or tag>`
- Merge branch: `sync/base-<version-or-date>`

## Conflict notes
- `<file/path>`: `<resolution summary>`

## Validation
- [ ] npm run check
- [ ] npm run test
- [ ] npm run build
```