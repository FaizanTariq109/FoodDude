# Step 6B: restaurant mutations

Status: migration 007 applied to hosted FoodDude after explicit approval on
2026-10-21; Steps 6A and 6B are approved for commit, push, and production deployment.
Before applying it, the linked CLI history matched migrations 001–006. The CLI
`supabase db push --linked --dry-run` listed only
`20261021000007_admin_restaurant_write.sql`, with no seeds or roles.

## Changed files

- `src/app/admin/restaurants/page.tsx`: add entry point, management label.
- `src/app/admin/restaurants/new/page.tsx`: guarded create page.
- `src/app/admin/restaurants/[id]/edit/page.tsx`: guarded real-record editor.
- `src/app/admin/restaurants/actions.ts`: independent auth, validation, RPC calls,
  safe errors and admin/home/places/detail revalidation.
- `src/components/admin/restaurant-form.tsx`: shared controlled editor, explicit
  URL/deactivation confirmations, status toggle, pending/error/success states.
- `src/components/admin/restaurant-catalogue.tsx`: edit and status actions;
  existing instant search and manually applied filters preserved.
- `src/lib/admin/restaurant-input.ts`: slug generation, validation and safe errors.
- `src/styles/admin.css`: responsive forms using existing After Hours tokens.
- `supabase/migrations/20261021000007_admin_restaurant_write.sql`: complete SQL.
- `scripts/check-restaurant-crud.mjs`: mocked SSR/action-boundary checks.
- `scripts/check-restaurant-crud-db.mjs`: isolated PostgreSQL execution checks.

Existing uncommitted Step 6A work and migrations 001–006 were preserved.

## Database design and permissions

`admin_create_restaurant` validates the eight official fields and returns the new
UUID. `admin_update_restaurant` changes only those fields on the supplied stable
UUID. `admin_set_restaurant_active` changes only active status. The existing trigger
updates `updated_at`; both update RPCs lock the row and compare the exact expected
timestamp before writing. PostgreSQL's unique constraint arbitrates slug races.
Failures roll back the statement. Clients never round timestamps to milliseconds.

Every public mutation independently checks `private.is_admin()` using the existing
verified caller. Functions are owned by postgres, SECURITY DEFINER, with an empty
search_path and qualified relation/helper names. PUBLIC, anon and service_role
execution is revoked; only authenticated receives execution, with non-admins then
denied by the membership check. The private validation helper grants no API access.
No role creation, admin membership changes, direct table write grants, RLS changes,
public column grants, legacy-field changes or production fixture writes occur.

URLs allow HTTP(S) only, no credentials, whitespace or backslashes, with a 2,048
character maximum. Name/slug limits are 200; descriptions 2,000; price is 1–4.
Blank optional form fields become null. The database validates independently.

## Verification

The local PostgreSQL test executes migration 007 after migrations 001–006 and
the unchanged 74-row seed. It checks anonymous/member/null identity/service-role
denials, spoofed metadata, helper failure, grants, fixed search paths, validation,
duplicate rollback, stale edit/status rejection, missing/malformed IDs, legacy
field preservation, row-preserving deactivation and restored public visibility.
All original seed rows and unrelated public-table contents remain identical.
This is an isolated auth-role simulation, not a hosted authentication write test.
Stale requests are tested sequentially; a real multi-connection race is not simulated.

Action/SSR tests cover authorization failure, payload allowlisting, timestamp
precision, errors without SQL leakage, revalidation, loaded values, pending/error/
success states. Existing Step 6A search/filter and auth guards remain covered.
Schema (59), auth foundation (13), session/UI, public places/detail/homepage and
prototype regression suites passed.

Browser verification used the existing signed-in local session backed by hosted
Supabase: 74 records, real edit values, generated/editable slugs, cancellation,
explicit confirmation controls and responsive 390px/1440px layouts. No successful
hosted mutation was performed. An earlier native-dialog test reached the missing
RPC and returned a generic failure; native dialogs were replaced with required
inline confirmations. The unchanged real record was reloaded afterwards.

Successful mutation flows are verified only in isolated PostgreSQL. Hosted
verification deliberately performs no successful mutations and creates no
disposable records in production.

Reproduce isolated checks:

```powershell
node scripts/check-restaurant-crud.mjs
node scripts/check-restaurant-crud-db.mjs <temporary-pglite-dist-index.js>
node scripts/check-admin-restaurants.mjs
npm run lint
npm run typecheck
npm run build
```

Run type generation and build sequentially because both write `.next/types`.
Turbopack initially passed; a subsequent run failed starting its CSS worker
(process exited before connection), including outside the sandbox. A final
Webpack fallback is used for this environmental failure, without changing config.
The final `npm run build -- --webpack` passed, including compilation, TypeScript,
page generation and build traces. The sandbox fallback first encountered EPERM;
the successful build ran outside the sandbox. Browser search/filter checks also
confirmed 1 result before applying a draft cafe filter, 0 after applying it, 1
after clearing filters, and 74 after independently clearing search. Status
confirmation cancellation left the restaurant active.

## Approved hosted rollout verification

The CLI project list verified FoodDude (`wtgjwcoinwcivtjtdunn`, ACTIVE_HEALTHY).
A fresh linked dry-run listed only migration 007, with no seeds or roles. The
approved `supabase db push --linked --yes` applied only that migration. Afterwards,
local/remote migration histories matched 001–007 and another dry-run was up to date.

`supabase/verify_admin_restaurant_permissions.sql` passed against the hosted
database inside a READ ONLY transaction. It selects existing admin/member
identities internally, then uses SET ROLE and JWT subject settings to verify
the same database authorization used by the API. Admin mutation calls reach
field validation with deliberately invalid arguments; member/anonymous calls
are denied before validation. The admin read RPC returns 74 records; privileged
reads by ordinary/anonymous roles fail. This is role simulation, not live-user
token testing. No credentials, emails, or account IDs are printed.

Pre/post rollout fingerprints matched exactly for all restaurant data, all
public/private RLS policies, table ACLs/RLS flags, and column ACLs:

- Restaurants: 74; fingerprint `b64baa025a1ec9184e61b7173084e28a`.
- Policies: `9c1db75cb1406d224da509177dbce4e9`.
- Table ACLs/RLS: `4892f36ad59400014ea9ad080941c3d7`.
- Column ACLs: `0b3666e8205b0d942ea0e8d09a1fe056`.

The full existing regression suite, mutation tests, admin search/guard tests,
lint, and typecheck passed again. Turbopack reproduced the known CSS worker
startup failure; Webpack passed outside the sandbox after the sandboxed build
encountered EPERM. No build configuration changes were required.

Read-only browser checks after migration loaded the create form, generated a
preview slug, loaded AlKhan's real edit fields, and displayed the deactivation
confirmation. Both previews were cancelled without submitting. The instant
search/manual-filter implementation and automated behavior tests remain intact.

The production target is Vercel project `food-dude`
(`prj_JZLpL9H9dX27nlwseX31oNexI6AZ`), GitHub repository
`FaizanTariq109/FoodDude`, branch `main`, public domain
`https://food-dude-eight.vercel.app`. Verify the newly pushed commit's deployment
is READY and perform read-only HTTP/browser checks before reporting completion.
