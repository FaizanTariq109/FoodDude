# Step 6A: read-only restaurant administration

`/admin` displays total, restaurant, cafe, active, and inactive counts from the
database. `/admin/restaurants` displays the official catalogue, including inactive
records. Category/status selections apply when Apply filters is submitted.
A separate search below the filters updates results immediately using a
case-insensitive literal substring, ignoring surrounding whitespace. Clear filters
resets only category/status (including pending selections); Clear search resets
only the search text. Initial URL parameters remain supported on page load.
The desktop table becomes stacked records on mobile using existing After Hours
colours, typography, and spacing. No public page or public data helper changed.

The list includes descriptions, price levels, safe HTTP(S) official website and
Instagram links, and expandable IDs/UTC timestamps. Missing metadata is explicit.
There are separate empty catalogue, no matches, and unavailable states. Errors
never fall back to seed records or show partial counts. No editing is implemented.

## Security

Migration [006](../supabase/migrations/20261021000006_admin_restaurant_read.sql)
defines `public.admin_restaurants()`. Its complete SQL is in that file.

- PostgreSQL `STABLE SECURITY DEFINER`, owned by `postgres`, with an empty
  `search_path` and explicitly qualified relation/helper references.
- Calls `private.is_admin()` before reading records. False/null raises SQLSTATE
  `42501`; helper errors propagate. No role, identity, or user ID parameters.
- Revokes default execution privileges from PUBLIC and all API roles, then grants
  execution only to `authenticated`. Ordinary authenticated users are rejected by
  the membership check even if they bypass the UI and call the RPC directly.
- Returns an explicit official-metadata projection; `personal_notes` and
  `is_favorite` are excluded from both the RPC and the server data projection.
- Changes no existing table/column privileges, RLS policies, seed data, or other
  catalogue access. Public reads still expose four identity columns of active
  restaurants only. Direct privileged table reads remain denied even for admins.
- Page, layout, and server data helper use the existing `requireAdmin()` guard.
  Queries use the existing cookie-based, per-request Supabase SSR client with the
  publishable key. No service-role keys or shared privileged caches.
- RPC results are fetched in slug-ordered batches of 100 to avoid the standard API
  row limit. After the guarded server load, filtering/counting happens in memory
  in the client component over the authorized catalogue. Search/filter interactions
  never make database requests.
  This is appropriate for the current small catalogue; concurrent owner SQL edits
  during multiple batches do not provide a single database snapshot.

## Verification

Executed successfully:

- `npm run lint`
- `npm run typecheck`
- `npm run build` (both admin routes remain dynamic)
- `node scripts/check-admin-access.mjs`
- `node scripts/check-admin-restaurants.mjs`
- `node scripts/check-admin-restaurants-db.mjs <PGlite module path>`
- Existing `check-schema` (59 checks), `check-auth-foundation` (13 checks),
  `check-auth-session`, `check-auth-ui`, `check-places-page`,
  `check-restaurant-detail`, `check-homepage`, and `check-prototype` scripts.

The database checks execute all six migrations and the unchanged 74-record seed
in isolated in-memory PostgreSQL via an existing temporary PGlite installation.
They add only an in-memory inactive fixture and simulate Supabase Auth roles and
`auth.uid()`. They verify admin success, non-admin/anonymous/null identity denial,
spoofed metadata rejection, revocation, helper failure, explicit function grants,
unchanged ACLs/RLS, excluded legacy fields, and invisible inactive public rows.
They do not access hosted Supabase.

Reproduce database checks with a temporary PGlite installation (not an application
dependency):

```powershell
npm install --prefix "$env:TEMP/fooddude-schema-check" --no-save --package-lock=false @electric-sql/pglite
node scripts/check-admin-restaurants-db.mjs "$env:TEMP/fooddude-schema-check/node_modules/@electric-sql/pglite/dist/index.js"
```

SSR checks exercise both pages and the real data helper with a mocked user-scoped
client. They verify guards precede privileged fetches, combined filters, literal
search, counts, unsafe-link rejection, empty/error states, and multi-batch reads.
Component handler tests also verify instant search, draft versus applied filters,
independent clearing, keyboard form submission, live counts, and no interaction
RPC calls. The refinement was checked in the existing authenticated browser with
74 records at a narrow viewport: pending filters, Apply filters, case/whitespace
search, independent clearing, and stacked mobile records all worked.
Existing proxy tests cover member 403, anonymous redirects, nested/RSC requests,
and authorization outages. Public source files and existing migrations are
unchanged; public catalogue regression checks pass.

## Manual rollout (not performed)

1. Review migration 006. Confirm migrations 001–005 are applied to the intended
   project and `private.is_admin()`/admin membership already work.
2. Apply **only** the complete migration 006 SQL through the normal owner-level
   migration process. Do not replay seeds or existing migrations. It makes no
   changes to existing RLS policies or restaurant data.
3. Refresh the PostgREST schema cache if the new RPC is not discovered after
   migration (`NOTIFY pgrst, 'reload schema';` from the SQL editor).
4. Run this application against that project with its existing public URL/key.
   An admin should see the live count (74 before any later catalogue changes),
   category/status totals, real names/slugs, and available official metadata.
   Verify search/category/status combinations, Clear, and narrow/mobile layouts.
5. Verify ordinary users receive 403 on `/admin` and `/admin/restaurants`, and
   anonymous visitors redirect to login. With a normal user's access token,
   directly call `admin_restaurants`: expect authorization denial. Without a user
   token, expect execution denial. Do not use a service-role key.
6. Confirm `/places` and `/places/[slug]` behave as before and public reads cannot
   select official metadata. An inactive record, if one exists, must appear only
   in the admin catalogue. Do not alter the original records just to test this;
   inactive fixture behavior is already covered locally.

At the original Step 6A checkpoint no hosted migration, account creation, data
mutation, push, or deployment was performed. Migration 006 has since been applied;
the approved Step 6B rollout verified matching local/remote migrations 001–007 and
74 unchanged hosted records. See `restaurant-crud.md` for current rollout evidence.

To withdraw this read-only capability, first revert the UI change, then remove
the new function with owner-level `drop function public.admin_restaurants();`.
Existing catalogue grants and policies need no rollback.
