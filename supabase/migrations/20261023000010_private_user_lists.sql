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
