# Step 7B — private custom places approval checkpoint

Release update, 23 October 2026: the owner approved production release. The exact reviewed migration 012 was applied to FoodDude and migrations 001–012 were verified synchronized. Aggregate record fingerprints and counts were unchanged: 75 restaurants, 9 branches, 0 bank offers, 3 profiles, 5 lists, 13 entries and 1 nonempty entry note. Hosted metadata/anonymous probes and all 22 offline regressions passed. The checkpoint narrative below records the earlier pre-approval state.

23 October 2026. Implemented locally; **migration 012 is NOT applied**. No production records were mutated. No commit, push or deployment was performed. HEAD remains `23ce8aa75489726cea5709f21b1ce83012b399f5`. Existing unrelated research, review documents and .gitignore work were preserved.

## Implementation

My Lists now has a My Places management action, leading to `/lists/places`. The primary sidebar remains Discover / My Lists / Offers, with the existing server-verified admin link. Compact private cards show only owner-entered fields; no generated photos, assumed neighborhood, address or description. Create/edit/delete forms open on demand in native accessible dialogs. Optional fields may all be blank.

Supported fields: required name and restaurant/cafe category, optional area, address, HTTPS Google Maps URL and personal notes. Personal notes belong to the place; existing list-specific notes remain independent. Long previews are clamped; editing exposes the complete value. Deletion explicitly confirms removal from every list and loss of membership notes, while preserving official restaurant entries.

The list picker searches official restaurants and the current owner's private places (including private area text), labels the two groups, hides existing memberships, and supports arrows, Enter and Escape. Private saved cards have no public restaurant detail URL. The My Places link is also available from list detail. The public `/places` document title was corrected from the legacy “My Places” to “Restaurants” to distinguish the public catalogue.

Custom places may be saved in multiple private lists, including Liked Places via its picker. Existing public hearts continue to affect only official restaurant memberships. Null restaurant references from private memberships are excluded from the public-heart snapshot; public Discover's liked filter never exposes private places.

Loading, empty, validation, pending, error, retry and success states are included. A browser test exposed that Next.js 16.4's `reset()` does not refetch server content; the new error screen uses its documented `retry()` API. Deletion feedback is delivered even when the card unmounts, and focus moves to the surviving success message after native dialog dismissal.

## Migration and security

Migration: `supabase/migrations/20261023000012_private_user_places.sql`. Full SQL is reproduced below. File SHA256: `90e47b47eb8e7069c7744ecde60678be07b37004a160ca5b272cbc3fdc261a78`.

- `user_places` uses `auth.uid()` ownership, four authenticated-only owner policies and RLS. No application-admin exception exists. Column INSERT/UPDATE grants exclude identity, owner and timestamps; clients cannot change ownership. Anonymous and service-role table privileges are revoked. No service-role credential is used.
- Constraints validate non-whitespace names, category, field lengths and a strict HTTPS Google Maps/share-link host allowlist. URL validation also runs in the action and before rendering stored links. Links use noopener/noreferrer.
- Adds nullable `user_place_id` with ON DELETE CASCADE to memberships. Existing restaurant_id becomes nullable, with exactly one reference enforced by `num_nonnulls(...) = 1`.
- The original official-entry uniqueness constraint and restaurant foreign key remain intact. A partial unique index prevents duplicate private-place membership; a separate foreign-key index supports deletion cleanup.
- Only entry INSERT gains the new column privilege. Entry IDs, list IDs and both reference columns remain immutable through UPDATE; notes-only editing stays protected.
- The existing entry INSERT policy is replaced transactionally to preserve the original official visibility branch and add the private-owner branch. Both require list ownership; the private branch also requires ownership of the referenced place. All other 010 and 011 list/entry policies and protected-default behavior remain unchanged.
- Deleting an owned private place cascades its memberships and membership notes. It does not delete lists, official restaurant entries or other owners' places. Account deletion retains the existing profile cascade model.
- No new SECURITY DEFINER functions, RPCs, public catalogue permissions or public search sources are introduced. The existing updated_at trigger function is reused. Migration 011's like RPC is unchanged.

CLI dry-run against linked FoodDude project `wtgjwcoinwcivtjtdunn` lists **only** migration 012, with no seeds or roles. No apply command was run. The dry-run is a pending-migration check; real SQL execution/security tests used isolated PGlite, not the hosted database.

## Regression and build results

PASS: all 22 regression scripts (14 app + 8 isolated database). The original 20 checks remain passing; two new scripts cover private places. Relevant app/SQL scripts were rerun after refinements.

New coverage includes two-owner/admin isolation; anonymous/null identity and service-role denials; create/edit/delete; immutable owner/identity/relationships; spoofed owner ignored by actions; cross-owner place/list reference attacks; exactly-one reference; duplicates for both reference types; multi-list saves/removal; private note separation; cascade cleanup; preserved public entries/notes and existing table ACLs/policies; inactive public references; unchanged official like/unlike behavior; pagination, stale records, URL validation and error sanitization.

PASS: lint with no warnings/errors, explicit typecheck, production Turbopack build and `git diff --check`. Webpack fallback was unnecessary. The normal deployable build was checked for synthetic ports/keys/test identities and secret-key strings; none were found. Local review settings are process-only; hosted environment files remain untouched.

## Actual local Next.js browser verification

Used the full compiled Next.js app at **http://127.0.0.1:3008/lists/places**, backed exclusively by the loopback synthetic transport at port 8768. Source/build copy is isolated under `.cache/next-ui-review-1792760691378`. This is not a partial component fixture. Synthetic accounts/data are reset when that backend restarts. Supabase RLS correctness is established by the independent SQL tests, not by trusting this transport.

Passed in the browser:

- Anonymous private-route sign-in path, then synthetic member login.
- Create with optional fields blank; edit name/address; pending controls; failed save retaining input and successful retry.
- Invalid Maps URL rejected without losing entered values.
- Keyboard traversal across picker groups and Enter addition; duplicate option exclusion.
- Same place added to two lists, reload persistence, removal from one list and re-addition; separate membership note saved.
- Delete confirmation, Escape cancellation/focus restoration, confirmed deletion removing both memberships; original six public entries and their original private note stayed intact.
- Empty state and deletion success feedback. Final post-delete focus verified on the success paragraph.
- Member's unique private cafe absent from public Discover search and absent from the synthetic admin's My Places.
- Read-error boundary shown, then the Try again control refetched and recovered after the synthetic failure was cleared.
- Private membership in Liked Places survived official Fuoco like/unlike; deleting the private place reduced the default list count to zero.
- Desktop 1440×900, short laptop 1280×600, mobile 390×844 and narrow mobile 320×740. No horizontal overflow. Desktop rail remains scroll-free at the checked desktop heights. At 320px the dialog scrolls internally so every field/action is reachable.

Injected read failures produce expected server error logging; they were cleared and recovery verified. No unresolved browser failure remains.

## Screenshot evidence

All are actual local Next.js screenshots with explicitly synthetic data:

- [Final desktop My Places](/E:/WORK/FoodDude/.cache/step7b-review/my-places-final-desktop.jpg)
- [Final mobile My Places](/E:/WORK/FoodDude/.cache/step7b-review/my-places-final-mobile.jpg)
- [My Lists management action](/E:/WORK/FoodDude/.cache/step7b-review/my-lists-management-action.jpg)
- [Grouped list picker](/E:/WORK/FoodDude/.cache/step7b-review/grouped-picker.jpg)
- [Mixed list and private membership note](/E:/WORK/FoodDude/.cache/step7b-review/mixed-list-private-note.jpg)
- [Desktop create dialog](/E:/WORK/FoodDude/.cache/step7b-review/create-desktop.jpg)
- [Mobile create dialog](/E:/WORK/FoodDude/.cache/step7b-review/create-mobile.jpg)
- [320px scrollable dialog](/E:/WORK/FoodDude/.cache/step7b-review/create-320.jpg)
- [Delete confirmation](/E:/WORK/FoodDude/.cache/step7b-review/delete-confirmation.jpg)
- [Edit failure with retained input](/E:/WORK/FoodDude/.cache/step7b-review/edit-error.jpg)
- [Read failure/retry screen](/E:/WORK/FoodDude/.cache/step7b-review/read-error-mobile.jpg)
- [Anonymous mobile route](/E:/WORK/FoodDude/.cache/step7b-review/anonymous-mobile.jpg)

## Changed files

New production files: migration 012; `src/lib/user-places.ts`; `src/lib/data/user-places.ts`; `src/components/lists/user-places.tsx`; `/lists/places` page, actions, loading and error components.

Updated production files: list detail page/action/types; overview, detail and picker components; liked-place snapshot projection; list styles; public catalogue metadata title. Updated existing private-list/like tests and added `scripts/check-user-places.mjs` and `scripts/check-user-places-db.mjs`.

Local-only review harness scripts were extended for the new table, owner scoping, membership cascade and controlled failures. Existing unrelated research scripts/data, .gitignore edits and historical review documents remain preserved. Nothing was staged or committed for Step 7B.

## Outstanding issues and approval

No known blocking local issue remains. Hosted API/schema-cache behavior, real signup/account lifecycle and true cross-device behavior must be verified only after separately approved migration/deployment with authorized owner accounts. PGlite is isolated PostgreSQL-compatible testing, not a hosted multi-connection concurrency/load test. Local browser tests used a synthetic transport, not a real hosted user session.

The normal application requires migration 012 before releasing this code; use the isolated local review URL for preview now. No public submissions, sharing/collaboration, photos, reviews, offers or scrapers were added.

**Await migration and visual approval. Do not apply 012, commit, push or deploy under the present authorization.**

## Full migration 012 SQL

```sql
-- Private owner-managed places; public catalogue rows and existing entries stay intact.
begin;

create table public.user_places (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120 and name ~ '[^[:space:]]'),
  category text not null check (category in ('restaurant', 'cafe')),
  area text check (char_length(area) <= 160),
  address text check (char_length(address) <= 1000),
  google_maps_url text check (google_maps_url is null or (
    char_length(google_maps_url) <= 2048 and google_maps_url !~ '[[:space:]]'
    and google_maps_url ~ '^https://((www[.])?google[.]com/maps([/?#]|$)|maps[.]google[.]com([/?#]|$)|maps[.]app[.]goo[.]gl/|goo[.]gl/maps/)'
  )),
  notes text check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_places_owner_name_idx on public.user_places(owner_id, name, id);
alter table public.user_places enable row level security;
revoke all on public.user_places from public, anon, authenticated, service_role;
grant select, delete on public.user_places to authenticated;
grant insert (name, category, area, address, google_maps_url, notes) on public.user_places to authenticated;
grant update (name, category, area, address, google_maps_url, notes) on public.user_places to authenticated;
create policy places_select_own on public.user_places for select to authenticated
  using (owner_id = (select auth.uid()));
create policy places_insert_own on public.user_places for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy places_update_own on public.user_places for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy places_delete_own on public.user_places for delete to authenticated
  using (owner_id = (select auth.uid()));
create trigger set_updated_at before update on public.user_places
  for each row execute function public.set_updated_at();

-- Deleting a private place removes its memberships and membership-specific notes.
alter table public.user_list_entries add column user_place_id uuid
  references public.user_places(id) on delete cascade;
alter table public.user_list_entries alter column restaurant_id drop not null;
alter table public.user_list_entries add constraint user_list_entries_one_place_check
  check (num_nonnulls(restaurant_id, user_place_id) = 1);
-- The existing UNIQUE(list_id, restaurant_id) is retained unchanged.
create unique index user_list_entries_list_user_place_idx
  on public.user_list_entries(list_id, user_place_id) where user_place_id is not null;
create index user_list_entries_user_place_idx on public.user_list_entries(user_place_id)
  where user_place_id is not null;
grant insert (user_place_id) on public.user_list_entries to authenticated;

-- Extend only the insert policy's reference alternatives. Owner scoping and the
-- original public-restaurant visibility check remain mandatory for their branch.
drop policy entries_insert_own_public on public.user_list_entries;
create policy entries_insert_own_public on public.user_list_entries for insert to authenticated
  with check (
    exists (select 1 from public.user_lists l where l.id = list_id and l.owner_id = (select auth.uid()))
    and (
      (user_place_id is null and restaurant_id is not null
        and exists (select 1 from public.restaurants r where r.id = restaurant_id))
      or (restaurant_id is null and user_place_id is not null
        and exists (select 1 from public.user_places p where p.id = user_place_id and p.owner_id = (select auth.uid())))
    )
  );

commit;
```
