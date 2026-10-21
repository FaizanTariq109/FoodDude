# Step 6B-3: official public restaurant metadata

Status: migration 008 applied after explicit user approval on 2026-10-21.
Commit, push, and deployment of this implementation are also approved. No hosted
restaurant records were altered by the migration or its verification.

## Migration 008

Complete SQL in `supabase/migrations/20261021000008_public_restaurant_metadata.sql`:

```sql
-- Add only official public metadata; preserve the existing active-only RLS.
begin;

grant select (short_description, price_level, website_url, instagram_url)
  on table public.restaurants
  to anon, authenticated;

commit;
```

This additive grant does not change policies, table-wide permissions, other
tables, RPCs, or existing data. The existing active-only SELECT policy still
filters every public result. The combined approved projection is exactly `id`,
`name`, `slug`, `category`, `short_description`, `price_level`, `website_url`, and
`instagram_url`. Legacy `personal_notes`/`is_favorite`, status, and timestamps are
not publicly selectable. No service-role keys are used.

The linked Supabase CLI project list verified FoodDude
(`wtgjwcoinwcivtjtdunn`, ACTIVE_HEALTHY). The actual linked dry-run returned:

```text
DRY RUN: migrations will *not* be pushed to the database.
Would push these migrations:
 • 20261021000008_public_restaurant_metadata.sql
{"upToDate":false,"dryRun":true,"migrations":["20261021000008_public_restaurant_metadata.sql"],"seeds":[],"roles":[],"message":"Finished supabase db push."}
```

After approval the project/dry-run checks were repeated, only migration 008 was
applied through the CLI, histories 001–008 matched, and a fresh dry-run returned
no pending migrations/seeds/roles.

## Public data flow and display

The user-scoped SSR data helper now selects and returns only the eight approved
columns. Prototype enrichment preserves those values explicitly and no longer
contains an invented description. Its photos, example locations, demo notes,
branches and offers remain separate from official data and labelled illustrative.

The shared card shows the real description (up to three visible lines) and a
populated price level as `Price level: N / 4`. It displays the real category,
including when prototype mood tags differ. Discover, My Places and existing
homepage card sections use this same component and enriched data flow.

The detail page puts official description, price level, website and Instagram
above the illustrative gallery. Missing descriptions/links have neutral empty
states; absent price levels are omitted. The prototype description never serves
as a fallback. HTTP(S) links reject credentials, whitespace, backslashes and
non-web protocols, use `noopener noreferrer`, and name the restaurant/new-tab
behavior for screen readers. Stored descriptions remain escaped React text.

Pages already use `connection()` and per-request Supabase SSR clients; no
cross-request data cache is introduced. The detail route's React `cache()` is
request-scoped. Existing admin actions revalidate home/places/detail paths.
Fresh page requests read current database values instead of prototype text.

Existing responsive grids remain unchanged. Description text wraps long words,
card descriptions are clamped, and official links wrap with 44px minimum target
height. At the original review checkpoint the local-file fixture preview was
rejected by browser URL policy. No alternative route or permission bypass was
added for previews. Live browser checks can now use the approved hosted grants.

## Verification

- `node scripts/check-public-metadata-db.mjs <temporary-pglite-dist-index.js>`:
  all eight migrations executed in isolated PostgreSQL; exact public column
  privileges, active/inactive visibility for anon and an ordinary member,
  denied legacy/status/timestamp/table-wide reads and writes, unchanged RLS and
  table grants, and unchanged original 74 seed rows. Admin RPC edits and
  deactivation use only a synthetic in-memory record.
- `node scripts/check-public-metadata.mjs`: actual card/detail SSR with synthetic
  official metadata, missing fields, labelled safe links, malicious URL/text
  rejection/escaping, demo separation, refreshed values, and existing filters.
  Discover/My Places route boundaries pass official metadata on each request.
- Updated `check-restaurant-detail` covers the expanded allowlist, stripped
  private extras, changed subsequent reads, and route enrichment. Updated
  `check-homepage` checks preservation of every official field in shared cards.
- Existing prototype/search/filter, places, admin catalogue/security, CRUD,
  schema (59), auth foundation (13), session, and auth UI regression suites.
- Lint, typecheck, and production build with the approved Webpack fallback.

The older hosted admin-permission verification SQL now checks denial of
`personal_notes` instead of `website_url`, so that legacy privacy assertion
continues to be valid before and after 008. That script was not run against
hosted Supabase during the original implementation checkpoint.

Hosted `verify_public_restaurant_metadata.sql` subsequently passed inside a READ
ONLY transaction. It tests the exact eight-column allowlist, no broad table
grants or column writes, anon/member active-only reads, private-field denials,
and ordinary-member mutation RPC denial. Existing member identity is selected
internally for role/JWT-subject simulation; no tokens or credentials are exposed.
There were 74 active records and zero inactive records in the hosted database;
inactive-row denial with populated metadata is additionally tested by isolated
synthetic fixtures. No production fixtures were created or modified.

Pre/post migration data fingerprints matched (`18ffef44fad62d4034b7d6d1563a4b52`),
as did policy (`9c1db75cb1406d224da509177dbce4e9`) and table ACL
(`4892f36ad59400014ea9ad080941c3d7`) fingerprints. The only expected grant change
is the four new column permissions; the effective eight-column allowlist was
verified independently. Regression tests, lint, typecheck, and Webpack production
build passed again before release.

## Approved release follow-up

1. Commit/push the reviewed application changes and confirm Vercel production
   reaches READY for the exact commit.
2. Check public Discover, My Places, home and detail routes for available official
   metadata, neutral missing states, safe links, and responsive layouts.
3. After deployment, inspect existing authenticated admin browser access. Only
   if available, use the normal Edit form to update the existing Chunk n Cheese
   short description to the exact text supplied by the user. Preserve every
   other field; never use an owner SQL/RPC write, service key, or auth bypass.
4. If the browser has no authenticated admin session, leave the record unchanged
   and ask the user to paste the description into the Edit form themselves.
