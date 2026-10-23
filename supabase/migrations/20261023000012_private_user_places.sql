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
