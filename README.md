# FoodDude

A personal Lahore restaurant discovery prototype built on the existing Next.js application and offline domain model.

## Run locally

Use Node.js 20.9+ and npm (validated with Node 20.19.0).

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No environment variables or external services are required. `.env.example` documents future Supabase configuration.

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

Shared React components live under `src/components/{layout,discovery,restaurants,offers,ui}`. Filter logic is in `src/lib/discovery.ts`; brand constants are in `src/lib/brand.ts`. CSS tokens and responsive styles live under `src/styles`. The stack remains Next.js App Router, React, strict TypeScript and Tailwind CSS. Lucide React is the only added application dependency.

Likes use React session state and reset on refresh. Filters run entirely against local data. No database, accounts, auth, storage, CRUD, scraping, payments or Maps API is connected.

See [the frontend guide](docs/frontend-prototype.md) for behavior, verification and refinement notes.

## Preserved domain work

- `supabase/migrations/001_initial_schema.sql`: 14 tables, constraints, indexes and triggers; unapplied.
- `supabase/seed.sql`: original 74 entries, rerunnable by slug.
- `src/types/index.ts`: full domain entities; original seed uses `RestaurantSeed`.
- [Data model](docs/data-model.md): relationships, applicability, deletion rules and integration decisions.
- `scripts/check-schema.mjs`: offline SQL integrity validation.

The canonical seed and both SQL files were checked against their pre-frontend SHA256 hashes and are unchanged. Backend integration is a later, separately scoped step.

## Dependency audit note

The existing audit has five high-severity development-only findings along the lint dependency chain (`eslint-config-next` through `fast-glob`, `micromatch`, and `braces`). The proposed major-version downgrade was not applied to this Next.js 16 project. Review a compatible upstream fix later.
