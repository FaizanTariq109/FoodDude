# FoodDude

A personal Lahore restaurant discovery prototype built on the existing Next.js application and offline domain model.

## Run locally

Use Node.js 20.9+ and npm (validated with Node 20.19.0).

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The mock-data frontend needs no external services.
`.env.example` documents configuration required when calling the Supabase helpers.

## Checks

```sh
npm run lint
npm run typecheck
node scripts/check-prototype.mjs
npm run build
npm start
```

The production build prerenders all 74 restaurant detail pages. Type checking generates Next.js route types first. On this Windows environment, the sandbox prevented Turbopack CSS workers from connecting. Building outside the sandbox after clearing only generated `.next/build` and `.next/cache` succeeded.

## Current product

- Home: editorial discovery, search, today's demo offers, group card matching, personal picks, cafes and moods.
- Discover: search, category, area, mood, bank/card, percentage, today and liked filters; sorting and mobile filter sheet.
- My Places: all 74 original entries with alphabetical browsing, illustrative personal notes and graceful missing-photo states.
- Offers: nine illustrative bank/restaurant promotions, branch applicability, weekday, cap, minimum spend, expiry and expandable terms.
- `/places/[slug]`: gallery, local likes, notes, example branches, branch-specific offers and related places.
- `/admin` and `/admin/login`: public placeholders only.

## Architecture

The original `src/data/restaurants.seed.ts` still contains exactly 55 restaurants and 19 cafes. Its names, categories and IDs are unchanged. `src/data/prototype/` separately enriches 16 entries by slug and contains example banks/cards and offers. Photos, locations, notes and promotions are prominently identified as illustrative and unverified. No actual business details were researched.

Shared React components live under `src/components/{layout,discovery,restaurants,offers,ui}`. Filter logic is in `src/lib/discovery.ts`; brand constants are in `src/lib/brand.ts`. CSS tokens and responsive styles live under `src/styles`. The stack remains Next.js App Router, React, strict TypeScript and Tailwind CSS, with Lucide React icons and Supabase SDK helpers.

Likes use React session state and reset on refresh. Filters run entirely against local data. No database, accounts, auth, storage, CRUD, scraping, payments or Maps API is connected.

See [the frontend guide](docs/frontend-prototype.md) for behavior, verification and refinement notes.

## Preserved domain work

- `supabase/migrations/20261020000001_initial_schema.sql`: 14 tables, constraints, indexes and triggers.
- `supabase/migrations/20261020000002_enable_rls.sql`: enables RLS and removes API-role table privileges.
- `supabase/seed.sql`: original 74 entries, rerunnable by slug.
- `src/types/index.ts`: full domain entities; original seed uses `RestaurantSeed`.
- [Data model](docs/data-model.md): relationships, applicability, deletion rules and integration decisions.
- `scripts/check-schema.mjs`: offline SQL integrity validation.

The canonical seed and migration contents remain unchanged. Connecting frontend
data to the backend is a later, separately scoped step.

## Supabase CLI preparation

The official `supabase` CLI is an npm development dependency. After `npm ci`,
run `npx supabase --version` to verify it. `supabase/config.toml` holds the local
CLI configuration. The hosted project is linked and both migrations have been
applied, as confirmed by the project owner.

Migrations run in timestamp order: `20261020000001_initial_schema.sql`, then
`20261020000002_enable_rls.sql`. They were renamed byte-for-byte from
`001_initial_schema.sql` and `002_enable_rls.sql`. The RLS migration's original
header still uses the old schema filename to preserve its contents.

`supabase/verify_rls.sql` is a read-only existence/RLS check. See the
[offline verification instructions](docs/data-model.md#verification) for schema,
lint and TypeScript checks. CLI migration-history comparison requires a database;
no hosted database verification is performed by the offline checks.

## Supabase SDK

`@supabase/supabase-js` and `@supabase/ssr` provide the SDK foundation, following
the [official SSR client pattern](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
They are pinned to 2.109.0 and 0.12.0 respectively for compatible peer dependencies
on the project's Node 20 runtime; newer SDK releases require Node 22.
Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in
`.env.local`, which remains ignored by Git. Never commit their values.

In browser components, import `createClient` from `@/lib/supabase/client`
and call `const supabase = createClient()`. In Server Components, Server Actions,
or Route Handlers, import it from `@/lib/supabase/server` and call
`const supabase = await createClient()`. The browser helper uses the SSR browser
singleton; the server helper creates a client per request using async `cookies()`
and the `getAll`/`setAll` adapter. Server Component cookie writes are unavailable;
authentication and session refresh must be implemented before authenticated use.

Configuration is validated only when a factory is called. Missing or blank
values produce an error naming the required variable without including values.
Imports do not initialize clients, so the mock frontend can build without these
variables. No secret or service-role key is used.

The owner confirms 74 imported records and RLS on all 14 tables. Application
grants and policies remain absent, so SDK setup does not grant data access.
No helper is wired into pages yet: all frontend data remains local mock data,
and no database queries, authentication, proxy, storage, or CRUD are implemented.

## Dependency audit note

The existing audit has five high-severity development-only findings along the lint dependency chain (`eslint-config-next` through `fast-glob`, `micromatch`, and `braces`). The proposed major-version downgrade was not applied to this Next.js 16 project. Review a compatible upstream fix later.
