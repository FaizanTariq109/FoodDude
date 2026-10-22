# Step 7A: private user lists

Migration 010 was explicitly approved and applied to hosted FoodDude (`wtgjwcoinwcivtjtdunn`) on 23 October 2026. Migrations 001–010 are synchronized. Committing, pushing to `origin/main`, and deploying this release are also approved; the exact release commit and production verification results are recorded in the deployment report.

## Delivered

- `/lists`: private collection overview, optional descriptions, creation and a genuine zero-list state.
- `/lists/[id]`: rename/description editing, explicit delete confirmation, public restaurant additions, removal, and optional private notes.
- Signed-in My Lists navigation and a restaurant-detail save control. Anonymous users get a clear sign-in path.
- A restaurant may belong to multiple lists. A database unique constraint rejects repeat saves in one list.
- Unavailable restaurants keep their saved reference and editable private notes. Public identity is resolved fresh with the existing RLS; no name/slug snapshots or unpublished metadata are exposed.
- Public `/places` and `/discover` routes remain available. Limited catalogue wording updates distinguish them from private lists. Existing prototype likes remain separate.
- No custom restaurants, sharing, collaborators, reviews or research imports.

## Changed files

- [`supabase/migrations/20261023000010_private_user_lists.sql`](../supabase/migrations/20261023000010_private_user_lists.sql)
- [`src/lib/lists.ts`](../src/lib/lists.ts)
- [`src/lib/data/lists.ts`](../src/lib/data/lists.ts)
- [`src/app/lists/actions.ts`](../src/app/lists/actions.ts)
- [`src/app/lists/page.tsx`](../src/app/lists/page.tsx)
- [`src/app/lists/error.tsx`](../src/app/lists/error.tsx)
- [`src/app/lists/[id]/page.tsx`](../src/app/lists/[id]/page.tsx)
- [`src/app/lists/[id]/not-found.tsx`](../src/app/lists/[id]/not-found.tsx)
- [`src/components/lists/list-forms.tsx`](../src/components/lists/list-forms.tsx)
- [`src/components/lists/save-restaurant.tsx`](../src/components/lists/save-restaurant.tsx)
- [`src/components/auth/account-navigation.tsx`](../src/components/auth/account-navigation.tsx)
- [`src/components/layout/app-shell.tsx`](../src/components/layout/app-shell.tsx)
- [`src/components/restaurants/restaurant-detail.tsx`](../src/components/restaurants/restaurant-detail.tsx)
- [`src/app/places/[slug]/page.tsx`](../src/app/places/[slug]/page.tsx)
- [`src/styles/lists.css`](../src/styles/lists.css)
- [`src/styles/globals.css`](../src/styles/globals.css)
- [`scripts/check-private-lists-db.mjs`](../scripts/check-private-lists-db.mjs)
- [`scripts/check-private-lists-hosted.mjs`](../scripts/check-private-lists-hosted.mjs)
- [`scripts/check-private-lists-permissions.mjs`](../scripts/check-private-lists-permissions.mjs)
- [`supabase/verify_private_user_lists.sql`](../supabase/verify_private_user_lists.sql)
- [`scripts/check-private-lists.mjs`](../scripts/check-private-lists.mjs)
- [`scripts/check-branches-db.mjs`](../scripts/check-branches-db.mjs)
- [`scripts/check-restaurant-detail.mjs`](../scripts/check-restaurant-detail.mjs)
- [`docs/private-user-lists.md`](../docs/private-user-lists.md)

The pre-existing `.gitignore`, research files, research scripts and research review documents were left untouched by this work.

## RLS and security inspection

`user_lists.owner_id` defaults to the verified database `auth.uid()` and references the existing `profiles` table, whose identity references `auth.users`. Clients cannot supply or update owner IDs. Profile/account deletion cascades to lists and entries.

All list operations require the current identity to own the row. All entry operations require an owned parent list. Each read and mutation uses a fresh SSR client with the user's session and the existing publishable key. Actions independently verify claims and rely on RLS for authorization; no caller-supplied user ID is accepted.

Authenticated callers receive column-scoped INSERT/UPDATE grants. IDs, owner IDs, timestamps, restaurant references and parent-list references are immutable through the API. Consequently entries cannot be moved into anyone else's list or retargeted to an unpublished restaurant. Table privileges inherited from PUBLIC and Supabase default grants are explicitly revoked on the two new tables. Anonymous callers receive no access. Admin status grants no additional access to private lists.

New entry INSERT checks both owned-list access and visibility of the referenced restaurant through the existing active-public SELECT policy. Notes UPDATE deliberately does not require restaurant visibility, so old entries stay editable after deactivation. Restaurant hard deletion is restricted while saved references exist. List deletion cascades its entries. The unique `(list_id, restaurant_id)` constraint also indexes parent-list lookups; owner/created and restaurant-reference indexes cover the remaining ownership and FK paths.

No SECURITY DEFINER function, service-role key, public notes view or public notes RPC was introduced. The existing timestamp trigger is reused. Tests compare existing table grants/RLS before and after 010 and confirm they remain unchanged, including with permissive default grants.

## Validation results

- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm run build`: PASS; `/lists` and `/lists/[id]` are dynamic server-rendered routes.
- `git diff --check`: PASS.
- All 19 local regression scripts below: PASS. PostgreSQL tests used an isolated PGlite PostgreSQL instance with Supabase-compatible roles and `auth.uid()`; no hosted fixture writes.

- `node scripts/check-schema.mjs <temporary-pglite-dist/index.js>` — PASS
- `node scripts/check-auth-foundation.mjs <temporary-pglite-dist/index.js>` — PASS
- `node scripts/check-admin-restaurants-db.mjs <temporary-pglite-dist/index.js>` — PASS
- `node scripts/check-restaurant-crud-db.mjs <temporary-pglite-dist/index.js>` — PASS
- `node scripts/check-public-metadata-db.mjs <temporary-pglite-dist/index.js>` — PASS
- `node scripts/check-branches-db.mjs <temporary-pglite-dist/index.js>` — PASS
- `node scripts/check-private-lists-db.mjs <temporary-pglite-dist/index.js>` — PASS
- `node scripts/check-prototype.mjs` — PASS
- `node scripts/check-homepage.mjs` — PASS
- `node scripts/check-places-page.mjs` — PASS
- `node scripts/check-restaurant-detail.mjs` — PASS
- `node scripts/check-auth-session.mjs` — PASS
- `node scripts/check-auth-ui.mjs` — PASS
- `node scripts/check-admin-access.mjs` — PASS
- `node scripts/check-admin-restaurants.mjs` — PASS
- `node scripts/check-restaurant-crud.mjs` — PASS
- `node scripts/check-public-metadata.mjs` — PASS
- `node scripts/check-branches.mjs` — PASS
- `node scripts/check-private-lists.mjs` — PASS

New database coverage includes two-user isolation in both directions; anonymous/null identity reads and writes; spoofed owners; immutable relationships and timestamps; multiple lists; duplicate and length constraints; unavailable/nonexistent restaurants; notes preservation/editing; stale IDs; list/account cascades; and returning to zero lists. Admins remain unable to inspect others' private data. Existing auth/admin/catalogue/branch regressions passed.

Action/SSR coverage verifies authentication for every operation, text and UUID validation, owner-safe write payloads, deletion confirmation, duplicates, stale records, sanitized errors, cache invalidation, pagination beyond 100 rows, anonymous pages without private queries, empty states and unavailable-restaurant placeholders.

A running local production server returned HTTP 200 without application errors for anonymous `/lists`, `/lists/not-a-uuid`, `/places`, `/discover`, and `/places/fuoco`. Private routes showed sign-in prompts; the restaurant page showed the save sign-in path. These public reads used the existing hosted catalogue without writing to it.

### Desktop/mobile review

Reviewed real list-page components rendered with synthetic local data, the production CSS and bundled fonts. Desktop: 1440px. Mobile: 390px and a narrow 320px check. Fixed cramped mobile account navigation and verified no horizontal overflow at 320px. Reviewed overview/create form, detail notes, unavailable references and add/edit forms. Actual anonymous production-server UI was also checked in the browser.

Layout fixtures deliberately do not execute mutations. Action tests and real PostgreSQL RLS tests cover those independently. No live two-account hosted UI test is claimed before migration approval.

Local captures (ignored working artifacts):

- [Desktop overview](../.cache/lists-review/overview-desktop.jpg)
- [Mobile overview](../.cache/lists-review/overview-mobile.jpg)
- [Desktop detail](../.cache/lists-review/desktop.jpg)
- [Mobile detail](../.cache/lists-review/mobile.jpg)

Recreate layout fixtures after a build with `node scripts/check-private-lists.mjs --fixtures`.

## Supabase CLI dry-run

Command: `npx supabase db push --dry-run` — PASS, exit 0.

```text
DRY RUN: migrations will *not* be pushed to the database.
Connecting to remote database...
Would push these migrations:
 • 20261023000010_private_user_lists.sql
{"upToDate":false,"dryRun":true,"migrations":["20261023000010_private_user_lists.sql"],"seeds":[],"roles":[],"message":"Finished supabase db push."}
```

## Approved hosted rollout and security verification

- CLI projects list confirmed linked project name FoodDude, reference `wtgjwcoinwcivtjtdunn`, status ACTIVE_HEALTHY.
- Repeated dry-run listed only `20261023000010_private_user_lists.sql`.
- `npx supabase db push --yes` applied exactly 010, with no seeds or role migrations.
- `npx supabase migration list --linked` showed all ten local and remote versions matched.
- Before/after read-only metadata exports matched exactly for all pre-existing application table grants, column grants, RLS flags, policies, and function definitions/ACLs. This includes restaurants, branches and profiles.
- `supabase/verify_private_user_lists.sql` queried PostgreSQL metadata inside a read-only transaction. `scripts/check-private-lists-permissions.mjs` verified both new tables have RLS enabled, all eight policies are restricted to authenticated owners, no application admin bypass is present, and authenticated column privileges match the migration exactly. API roles have neither superuser nor BYPASSRLS.
- `node scripts/check-private-lists-hosted.mjs` passed anonymous SELECT-denial probes for lists, entries and profiles, public restaurant/branch projection checks, and forbidden legacy/internal column checks. It uses the publishable key only and never reads private list contents or writes fixtures.
- All 19 prior local regressions passed again after applying 010. Lint, typecheck and the Turbopack production build passed; Webpack fallback was not needed.
- No hosted user lists, entries, profiles, restaurant records or branch records were created, edited or deleted for testing. No service-role credentials or paid services were used.

To repeat the metadata inspection: export the SQL results with `npx supabase db query --linked --file supabase/verify_private_user_lists.sql --output json`. Metadata exports remain in ignored `.cache/` files; they contain no private records. The permissions checker accepts the pre-existing-permissions baseline JSON, after JSON and security JSON in that order.

## Remaining manual authenticated testing

Hosted mutation testing is intentionally excluded by the user's read-only test scope. A consenting user should verify, with their own account:

1. Create, rename and describe lists; delete with confirmation and return to zero lists.
2. Add/remove active public restaurants; save one restaurant in multiple lists; verify repeat additions are rejected.
3. Save/edit/clear private notes; reload, sign out/in and use a second device to verify persistence.
4. Verify only their own lists are available. Owner isolation and admin non-bypass were tested with isolated synthetic users and PostgreSQL roles; no other hosted user's lists were accessed.
5. When a real restaurant is legitimately deactivated, confirm existing saves/notes remain and public identity is hidden. No production restaurant was toggled merely for testing.
6. Review signed-in My Lists navigation, restaurant detail save forms, pending/error states, and stale/deleted list IDs on desktop and mobile.

## Full migration 010 SQL

The following is an exact copy of `supabase/migrations/20261023000010_private_user_lists.sql`.

```sql
-- Private lists only. Existing catalogue/auth policies and grants are unchanged.
begin;

create table public.user_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80 and btrim(name) <> ''),
  description text check (char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_list_entries (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.user_lists(id) on delete cascade,
  -- Preserve saved references on deactivation; hard deletion requires explicit cleanup.
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  notes text check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (list_id, restaurant_id)
);

create index user_lists_owner_created_idx on public.user_lists(owner_id, created_at desc);
create index user_list_entries_restaurant_idx on public.user_list_entries(restaurant_id);

alter table public.user_lists enable row level security;
alter table public.user_list_entries enable row level security;
revoke all on public.user_lists, public.user_list_entries from public, anon, authenticated, service_role;
grant select, delete on public.user_lists, public.user_list_entries to authenticated;
-- Identity, ownership, timestamps and entry relationships cannot be reassigned.
grant insert (name, description) on public.user_lists to authenticated;
grant update (name, description) on public.user_lists to authenticated;
grant insert (list_id, restaurant_id, notes) on public.user_list_entries to authenticated;
grant update (notes) on public.user_list_entries to authenticated;

create policy lists_select_own on public.user_lists for select to authenticated
  using (owner_id = (select auth.uid()));
create policy lists_insert_own on public.user_lists for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy lists_update_own on public.user_lists for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy lists_delete_own on public.user_lists for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy entries_select_own on public.user_list_entries for select to authenticated
  using (exists (select 1 from public.user_lists l where l.id = list_id and l.owner_id = (select auth.uid())));
create policy entries_insert_own_public on public.user_list_entries for insert to authenticated
  with check (
    exists (select 1 from public.user_lists l where l.id = list_id and l.owner_id = (select auth.uid()))
    -- The existing restaurants SELECT policy exposes active public rows only.
    and exists (select 1 from public.restaurants r where r.id = restaurant_id)
  );
create policy entries_update_own on public.user_list_entries for update to authenticated
  using (exists (select 1 from public.user_lists l where l.id = list_id and l.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.user_lists l where l.id = list_id and l.owner_id = (select auth.uid())));
create policy entries_delete_own on public.user_list_entries for delete to authenticated
  using (exists (select 1 from public.user_lists l where l.id = list_id and l.owner_id = (select auth.uid())));

create trigger set_updated_at before update on public.user_lists
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_list_entries
  for each row execute function public.set_updated_at();

commit;
```
