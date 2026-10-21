-- Read-only hosted verification after migration 007. No fixtures or mutations.
-- Run through the linked owner CLI; identities are selected internally and are
-- never printed. SET ROLE simulates API roles without creating accounts/tokens.
begin transaction read only;

do $$
declare admin_id uuid; member_id uuid;
begin
  select m.user_id into admin_id from private.admin_memberships m limit 1;
  if admin_id is null then raise exception 'No admin available for verification'; end if;
  select u.id into member_id from auth.users u
    where not exists (select 1 from private.admin_memberships m where m.user_id = u.id) limit 1;
  if member_id is null then raise exception 'No ordinary account available for verification'; end if;
  perform pg_catalog.set_config('fooddude.verify_admin', admin_id::text, true);
  perform pg_catalog.set_config('fooddude.verify_member', member_id::text, true);
end;
$$;

-- Check exact execute grants, owner, definer status, and fixed search path.
do $$
declare f record; api_role text;
begin
  for f in select p.oid, p.prosecdef, p.proconfig, pg_catalog.pg_get_userbyid(p.proowner) as owner
    from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('admin_create_restaurant', 'admin_update_restaurant', 'admin_set_restaurant_active')
  loop
    if not f.prosecdef or f.owner <> 'postgres' or not ('search_path=""' = any(f.proconfig)) then
      raise exception 'Unexpected mutation function security configuration';
    end if;
    foreach api_role in array array['anon','authenticated','service_role'] loop
      if pg_catalog.has_function_privilege(api_role, f.oid, 'EXECUTE') <> (api_role = 'authenticated') then
        raise exception 'Unexpected mutation function execute privileges';
      end if;
    end loop;
  end loop;
  if (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in
      ('admin_create_restaurant','admin_update_restaurant','admin_set_restaurant_active')) <> 3 then
    raise exception 'Expected exactly three mutation functions';
  end if;
end;
$$;

set local role authenticated;
do $$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', pg_catalog.current_setting('fooddude.verify_admin'), true);
  if private.is_admin() is not true then raise exception 'Admin identity denied'; end if;
  if (select count(*) from public.admin_restaurants()) <> 74 then raise exception 'Unexpected catalogue count'; end if;
  -- Invalid arguments deliberately stop after authorization, before any write or
  -- row lock. READ ONLY is a second independent guard against data changes.
  begin
    perform public.admin_create_restaurant(null,null,null,null,null,null,null,null);
    raise exception 'Expected field validation';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.admin_update_restaurant(null,null,null,null,null,null,null,null,null,null);
    raise exception 'Expected field validation';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.admin_set_restaurant_active(null,null,null);
    raise exception 'Expected status validation';
  exception when invalid_parameter_value then null; end;
end;
$$;

do $$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', pg_catalog.current_setting('fooddude.verify_member'), true);
  if private.is_admin() is not false then raise exception 'Ordinary account incorrectly authorized'; end if;
  begin
    perform public.admin_create_restaurant(null,null,null,null,null,null,null,null);
    raise exception 'Ordinary create was not denied';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_update_restaurant(null,null,null,null,null,null,null,null,null,null);
    raise exception 'Ordinary update was not denied';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_set_restaurant_active(null,null,null);
    raise exception 'Ordinary status was not denied';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_restaurants();
    raise exception 'Ordinary privileged read was not denied';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;

set local role anon;
do $$
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.admin_create_restaurant(null,null,null,null,null,null,null,null);
    raise exception 'Anonymous create was not denied';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_update_restaurant(null,null,null,null,null,null,null,null,null,null);
    raise exception 'Anonymous update was not denied';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_set_restaurant_active(null,null,null);
    raise exception 'Anonymous status was not denied';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_restaurants();
    raise exception 'Anonymous privileged read was not denied';
  exception when insufficient_privilege then null; end;
  begin
    perform r.personal_notes from public.restaurants r;
    raise exception 'Public legacy personal data was not denied';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;

select 'PASS admin authorization, ordinary/anonymous denial, fixed grants; no data written' as result;
rollback;
