-- Foundation only: no catalogue permissions or existing tables are changed.
begin;

create schema if not exists private authorization postgres;
revoke all on schema private from public, anon, authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'FoodDude member'
    check (char_length(display_name) between 1 and 80 and btrim(display_name) <> ''),
  avatar_path text
    check (avatar_path is null or (char_length(avatar_path) between 1 and 1024 and btrim(avatar_path) <> '')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles owner to postgres;
alter table public.profiles enable row level security;
revoke all on table public.profiles from public, anon, authenticated, service_role;

grant select (id, display_name, avatar_path, created_at, updated_at)
  on public.profiles to authenticated;
grant update (display_name, avatar_path) on public.profiles to authenticated;

create policy "Read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Edit own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Trigger-only privileged creation; metadata never controls identity or roles.
create function private.create_user_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
alter function private.create_user_profile() owner to postgres;
revoke all on function private.create_user_profile() from public, anon, authenticated, service_role;
create trigger create_user_profile after insert on auth.users
  for each row execute function private.create_user_profile();

-- Existing accounts also receive normal personal profiles.
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

create table private.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.admin_memberships owner to postgres;
alter table private.admin_memberships enable row level security;
revoke all on table private.admin_memberships from public, anon, authenticated, service_role;
-- No membership policies or mutation functions. Assignment is owner-only SQL.

-- No user-id parameter: callers can check only their authenticated identity.
create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.admin_memberships where user_id = (select auth.uid())
  );
$$;
alter function private.is_admin() owner to postgres;
revoke all on function private.is_admin() from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

commit;
