-- One protected private favorites collection per profile. Custom data is untouched.
begin;

alter table public.user_lists add column kind text not null default 'custom'
  constraint user_lists_kind_check check (kind in ('custom', 'liked'));
alter table public.user_lists add constraint user_lists_liked_identity_check
  check (kind <> 'liked' or (name = 'Liked Places' and description is null));
create unique index user_lists_one_liked_per_owner_idx
  on public.user_lists(owner_id) where kind = 'liked';

-- Column INSERT/UPDATE grants from 010 do not include kind or owner_id.
-- Restrictive policies also protect the special row from direct API mutations.
create policy lists_update_custom_only on public.user_lists as restrictive
  for update to authenticated using (kind = 'custom') with check (kind = 'custom');
create policy lists_delete_custom_only on public.user_lists as restrictive
  for delete to authenticated using (kind = 'custom');

-- Necessary privilege boundary: ordinary API clients cannot insert kind/owner_id.
-- Trigger-only, no user-supplied identity; NEW is the profile being inserted.
create function private.initialize_liked_places() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_lists(owner_id, name, kind)
    values (new.id, 'Liked Places', 'liked')
    on conflict (owner_id) where kind = 'liked' do nothing;
  return new;
end;
$$;
alter function private.initialize_liked_places() owner to postgres;
revoke all on function private.initialize_liked_places() from public, anon, authenticated, service_role;
create trigger initialize_liked_places after insert on public.profiles
  for each row execute function private.initialize_liked_places();

-- Creates one NEW special list per existing profile, including those with a
-- custom list already called Favorites or Liked Places. No membership is copied.
insert into public.user_lists(owner_id, name, kind)
  select id, 'Liked Places', 'liked' from public.profiles
  on conflict (owner_id) where kind = 'liked' do nothing;

-- Idempotent desired-state operation, not an unsafe read/flip toggle.
-- Invoker privileges preserve 010's owner and public-restaurant RLS checks.
create function public.set_restaurant_liked(p_restaurant_id uuid, p_liked boolean)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  liked_list uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_restaurant_id is null or p_liked is null then
    raise exception 'Invalid like request' using errcode = '22023';
  end if;
  select id into liked_list from public.user_lists
    where owner_id = auth.uid() and kind = 'liked';
  if liked_list is null then
    raise exception 'Liked Places unavailable' using errcode = '42501';
  end if;
  if p_liked then
    -- Already saved inactive references remain valid and reveal no catalogue data.
    if not exists (select 1 from public.user_list_entries
      where list_id = liked_list and restaurant_id = p_restaurant_id) then
      insert into public.user_list_entries(list_id, restaurant_id)
        values (liked_list, p_restaurant_id)
        on conflict (list_id, restaurant_id) do nothing;
    end if;
  else
    delete from public.user_list_entries
      where list_id = liked_list and restaurant_id = p_restaurant_id;
  end if;
  return p_liked;
end;
$$;
revoke all on function public.set_restaurant_liked(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.set_restaurant_liked(uuid, boolean) to authenticated;

commit;
