# Step 6C: restaurant branches

Status: migration 009 was approved and applied to hosted FoodDude on 2026-10-22. Migrations 001–009 are synchronized. The user also approved committing, pushing and deploying Step 6C; the exact release commit and deployment status are recorded in the deployment report.

The complete migration SQL is [20261022000009_restaurant_branches.sql](../supabase/migrations/20261022000009_restaurant_branches.sql). It is additive and contains no restaurant or branch data changes.

## Behavior

Open an existing restaurant's admin Edit page and follow “Manage branches”. All saved branches, including inactive ones, appear below the restaurant form. Each branch has separate edit and status controls; adding a branch uses a separate form. Deactivation is reversible. There is no delete operation or way to move a branch to another restaurant.

Unknown optional values stay null. A name, area or address must identify the location. Latitude and longitude are an optional pair, limited to ±90 and ±180 and stored with the existing six decimal precision. Both application and SQL validate these fields. Maps URLs accept HTTPS links on google.com/maps, www.google.com/maps, maps.google.com, maps.app.goo.gl and goo.gl/maps; credentials, other hosts, unsafe schemes, whitespace and backslashes are rejected. Unsupported Google country-domain links should be replaced with the canonical Google Maps share link.

The duplicate check compares normalized name, area and address within one restaurant, including inactive branches. Parent row locks serialize checks and inserts/updates through the RPCs. Exact matches are rejected with a request to review the existing branches. This is not fuzzy matching: administrators still review nearby or differently named locations. Existing duplicates are neither merged nor modified by the migration.

Public detail pages show real active branches, addresses, safe phone links and labelled directions links. Missing addresses have a neutral message; missing branch records have an empty state. A failed read shows an unavailable state and never falls back to demo branches. Illustrative branch lists and their demo-offer filter are removed from the detail page. Unrelated demo imagery, notes and offers retain disclaimers. No opening hours are implemented.

Forms retain entered fields after validation errors, disable while saving, report errors accessibly and show a link to reload the latest branches after success. Successful actions revalidate admin pages and public detail pages. Queries use per-request SSR clients, explicit projections and pagination; no browser credentials or service-role keys are introduced. Existing instant restaurant search and manual filters are unchanged.

## Security

- Branch RLS stays enabled. Its new SELECT policy requires an active branch and a parent visible through the existing active-only restaurant RLS policy. The parent subquery reads only its already-public UUID; restaurant policies and grants remain unchanged.
- Anon and authenticated receive column-level SELECT only on branch id, restaurant_id, name, area, address, phone, google_maps_url, latitude and longitude. No table-wide SELECT or direct writes are granted. Status and timestamps are excluded from public reads.
- Four public RPCs provide admin branch reads, create, update and status changes. Each independently checks `private.is_admin()`. They accept no user identity or role argument. A private shared mutation implementation also checks membership and cannot be executed by API roles.
- Definer RPCs belong to postgres, use an empty search path and reference application objects by schema. Execution is revoked from PUBLIC, anon and service_role, and granted only to authenticated; membership is still required inside each RPC. Authorization failures propagate without reading/writing privileged data.
- Existing restaurant foreign keys remain authoritative. Mutations lock and verify the parent, and edits/status changes require both the branch UUID and its original restaurant UUID. No parent reassignment field exists. Updates lock the branch and compare the exact database `updated_at` timestamp; stale requests fail before writing.
- No delete RPC, imports, new restaurant creation, bank-offer changes, existing seed changes or prototype locations are included. Kababjees and Kababjees Fried Chicken remain separate concepts; branch identity never matches across restaurants.

## Verification

All database mutations in tests run against disposable, in-memory PGlite fixtures. Snapshots verify migration 009 changes no existing rows or policies/table grants, and all 74 original restaurant rows and any original branches remain unchanged after tests. No tests write to hosted Supabase.

Run:

```powershell
$dbRuntime = 'C:/Users/FAIZAN/AppData/Local/Temp/fooddude-schema-check/node_modules/@electric-sql/pglite/dist/index.js'
node scripts/check-branches.mjs
node scripts/check-branches-db.mjs $dbRuntime
node scripts/check-restaurant-detail.mjs
npm run lint
npm run typecheck
npm run build -- --webpack
```

Branch checks cover admin CRUD/status, independent action authorization, ordinary/anonymous denials, helper outages, exact execute privileges and projections, active child/active parent public visibility, restricted fields, no direct writes, valid/missing parent relationships, cross-parent rejection, null optional fields, coordinate pair/range/nonfinite validation, unsafe links, normalized duplicates, stale edits, pagination, refreshed reads, and SSR list/form/public empty/error/pending/success states. The read-only post-rollout SQL is also tested with isolated fixtures.

Existing authentication, admin catalogue/instant-search, restaurant CRUD, public metadata, homepage, Discover/My Places, detail, prototype and schema regression scripts pass. Historical migration tests intentionally test their original checkpoints rather than assuming later permissions were already applied.

Local checkpoint results: lint passed; standalone typecheck passed; production `next build --webpack` passed with all routes rendered dynamically. `git diff --check` passed. All 19 changed files are within Step 6C; the credential-pattern scan found zero matches. Authentication helpers, existing migrations and seed data are unchanged.

Before rollout, browser review at 1280×900 and 390×844 checked the existing restaurant editor and public detail branch unavailable states. After migration 009, the existing authenticated localhost session loaded the production build against hosted Supabase, showing the correct zero-branch list and accessible Add branch form at desktop/mobile widths. No form was submitted. Production browser access is signed out, so authenticated production UI verification requires the administrator's normal sign-in; production sign-in guards can be checked without bypassing authentication. Populated branches and actual saves are covered by isolated fixtures rather than creating hosted test records.

## Dry-run checkpoint (2026-10-22)

The CLI confirms linked project **FoodDude**, `wtgjwcoinwcivtjtdunn`, status ACTIVE_HEALTHY. Migration list: 001–008 have identical local/remote versions; 009 is local-only.

```text
DRY RUN: migrations will *not* be pushed to the database.
Would push these migrations:
 • 20261022000009_restaurant_branches.sql
{"upToDate":false,"dryRun":true,"migrations":["20261022000009_restaurant_branches.sql"],"seeds":[],"roles":[]}
```

## Rollout after explicit approval

1. Reconfirm linked FoodDude project and run `npx --no-install supabase db push --linked --dry-run`. Only 009 may be pending.
2. Apply 009 through the linked CLI only after approval, then verify 001–009 are synchronized.
3. Run `supabase/verify_restaurant_branches.sql` through the owner CLI in its read-only transaction, followed by the existing restaurant permission verification scripts. It compares public branch IDs against the owner-visible active-child/active-parent set, checks all admin reads and exact grants, tests invalid admin arguments before any row lock/write, and verifies non-admin RPC denial. No fixtures are inserted and no account IDs are printed. It requires existing admin and ordinary accounts.
4. Re-run regressions, lint, typecheck and production build; inspect the diff for secrets/unrelated changes. Push/deploy only with approval.
5. Verify the exact production commit reaches READY. Read-only smoke-test desktop/mobile public branch output and normal authenticated admin branch lists/forms. Do not create/edit any hosted branch merely for testing. Use an isolated environment for actual form-save smoke tests unless specific real edits are separately authorized.

Before 009, new branch reads correctly report unavailable. The application is released after the migration to avoid that interim state. Do not create hosted fixtures for populated end-to-end browser checks.

## Approved hosted rollout verification (2026-10-22)

- Reconfirmed FoodDude, `wtgjwcoinwcivtjtdunn`; the repeated dry-run listed only `20261022000009_restaurant_branches.sql`. The CLI applied only 009, without seeds or role imports, and migration listing confirms 001–009 match locally/remotely.
- `verify_restaurant_branches.sql` passed on hosted Supabase in a read-only transaction: admin reads and validation paths allowed, member/anonymous RPC access denied, exact public column allowlist and hardened function privileges confirmed, and visible branch IDs match the active-child/active-parent set.
- `verify_public_restaurant_metadata.sql` passed: existing restaurant metadata grants/RLS and private-field denial remain intact; ordinary users cannot mutate metadata.
- `verify_admin_restaurant_permissions.sql` passed: existing admin restaurant reads/mutation validation and ordinary/anonymous denials are preserved, without data writes.
- The before/after snapshots match exactly for restaurant and branch records, all existing policies, all table ACLs and all unrelated column ACLs. The catalogue has 74 restaurants and zero branches. There are currently no inactive restaurant or branch records to exercise hosted visibility exclusions with real rows; isolated tests cover those states without hosted fixtures.
- Basil Bistro was already active before rollout and remains unchanged. No reactivation or other restaurant mutation was performed. No CSV import, new restaurant, branch creation, record edit, deletion or status change occurred.
- Parallel CLI checks initially conflicted while creating temporary login credentials; sequential retries passed. This was a CLI connection issue, not a database authorization failure.

## Changed files

- `supabase/migrations/20261022000009_restaurant_branches.sql`
- `supabase/verify_restaurant_branches.sql`
- `src/lib/branches.ts`
- `src/lib/admin/branch-input.ts`
- `src/lib/data/branches.ts`
- `src/lib/data/admin-branches.ts`
- `src/app/admin/restaurants/branch-actions.ts`
- `src/app/admin/restaurants/[id]/edit/page.tsx`
- `src/components/admin/branch-form.tsx`
- `src/components/admin/branch-management.tsx`
- `src/app/places/[slug]/page.tsx`
- `src/components/restaurants/restaurant-branches.tsx`
- `src/components/restaurants/restaurant-detail.tsx`
- `src/styles/admin.css`
- `src/styles/product.css`
- `scripts/check-branches.mjs`
- `scripts/check-branches-db.mjs`
- `scripts/check-restaurant-detail.mjs`
- `docs/restaurant-branches.md`
