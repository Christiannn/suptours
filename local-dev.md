# Local development

Kort guide til Supabase lokalt, database-synk og login til udvikling.

## Forudsætninger

- [Docker](https://docs.docker.com/get-docker/) eller Podman (Supabase CLI bruger det til lokale services)
- Node.js (matcher projektets krav)

## Start den lokale database (Supabase)

```bash
npm run supabase:start
```

eller:

```bash
npx supabase start
```

Projektet bruger `supabase:start` med `-x logflare,vector` for lidt lettere stack (se `package.json`).

Tjek at alt kører:

```bash
npx supabase status
```

Herfra kopierer du **`API URL`** og **`anon key`** til din `.env` (samme variabler som i `.env.example`: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`).

Stop når du er færdig:

```bash
npm run supabase:stop
```

## Opdatere lokal DB og TypeScript-typer

**Anbefalet kommando** (migrationer + seed + genererede typer):

```bash
npm run reset
```

Det svarer til `npx supabase db reset && npm run types`:

1. Kører alle filer i `supabase/migrations/`
2. Kører `supabase/seed.sql`
3. Skriver `src/lib/database.types.ts` ud fra den lokale database

**Kun typer** (uden at røre data):

```bash
npm run types
```

Brug det hvis skemaet allerede matcher, og du bare vil opdatere typings efter et reset eller et manuelt skema-trin.

## Hvornår skal du køre `db reset` lokalt?

`supabase db reset` (som `npm run reset` bruger) **sletter al data** i den lokale Postgres og bygger den forfra ud fra migrationer + seed.

Kør det typisk når du:

- Har hentet nye migrationer fra git
- Har tilføjet eller ændret migrationer selv og vil verificere en ren kørsel
- Vil tilbage til en kendt tilstand med frisk seed

**Obs:** Brug den lokale reset til udvikling — ikke mod et delt eller produktionsprojekt med `--linked` uden at vide hvad du gør. Til remote deployment bruges typisk `npm run db:push` mod et linket projekt (se `README.md`).

## Kør appen (dev)

```bash
npm install
npm run dev
```

Åbn den URL Vite viser (typisk `http://localhost:5173`).

### API-nøgler (admin / scraper)

I **projektrodens** `.env` (ved siden af `package.json`):

| Variabel | Brug |
|----------|------|
| **`GEMINI_API_KEY`** | Gemini (eller sæt Claude + `ANTHROPIC_API_KEY`) til AI-trin |
| **`BRAVE_SEARCH_API_KEY`** | **Påkrævet til scraper fase 1** (“Kør søgning”) — [Brave Search API](https://brave.com/search/api/) |
| `ANTHROPIC_API_KEY` | Kun hvis du vælger Claude under Agenter |

- Brug præcis navne med **underscores** (fx ikke `GEMINI-API-KEY`).
- Filen skal hedde `.env` eller `.env.local` i **projektroden** (samme mappe som `package.json`).
- Efter du retter `.env`, **genstart** dev-serveren (`Ctrl+C`, derefter `npm run dev`).
- På **Admin → Agenter** vises **Indlæst** ved `GEMINI_API_KEY`, når serveren kan se variablen (læses via SvelteKit + `process.env` fallback).

## Login: admin og “almindelig” bruger

### Seed-bruger (admin)

`supabase/seed.sql` opretter én dev-bruger med både `auth.users` og `auth.identities` (påkrævet af GoTrue til email/password), sætter `aud`/`role`, hasher kodeord med `pgcrypto` (`crypt(..., gen_salt('bf'))`), og sætter `profiles.is_admin = true`.

| Felt | Værdi |
|------|--------|
| Email | `admin@suptours.dk` |
| Password | `password` |

Log ind i appen — så har du adgang til `/admin`.

**Hvis du får “Invalid login credentials” efter et reset:** Sørg for at du kører **`npm run reset`** med den **nyeste** `seed.sql`. Ældre seeds indsatte kun en række i `auth.users` uden tilhørende række i `auth.identities` (og manglede `aud`/`role`) — så virker `signInWithPassword` ikke, selv om brugeren findes i databasen.

**Manuelt tjek i Studio (SQL):** Der skal findes en række i `auth.identities` med `provider = 'email'` og `provider_id = 'admin@suptours.dk'` for den samme `user_id` som i `auth.users`.

### Anden (test) bruger uden admin

Opret en ny konto via appens **sign up** (`/signup`), eller opret en bruger i Studio under Authentication. Det giver en normal bruger til at teste flows uden admin-rettigheder.

## Produktionstjek lokalt (valgfrit)

```bash
npm run build
npm run preview
```

Brug samme `.env` mod den lokale Supabase som i dev.
