-- Owner-run hosted verification for migration 008. Read only; no test fixtures.
begin transaction read only;

do $$
declare member_id uuid;
begin
  select u.id into member_id from auth.users u where not exists
    (select 1 from private.admin_memberships m where m.user_id = u.id) limit 1;
  if member_id is null then raise exception 'No ordinary account available for verification'; end if;
  perform pg_catalog.set_config('fooddude.verify_member', member_id::text, true);
  perform pg_catalog.set_config('fooddude.verify_active_count',
    (select count(*)::text from public.restaurants r where r.is_active), true);
  perform pg_catalog.set_config('fooddude.verify_inactive_ids',
    (select coalesce(array_agg(r.id), '{}'::uuid[])::text from public.restaurants r where not r.is_active), true);
end;
$$;

-- Assert the exact effective allowlist, not just the newly granted columns.
do $$
declare api_role text; col record;
begin
  foreach api_role in array array['anon','authenticated'] loop
    if pg_catalog.has_table_privilege(api_role,'public.restaurants','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
      raise exception 'Unexpected broad restaurant table privilege';
    end if;
    for col in select a.attname from pg_catalog.pg_attribute a
      where a.attrelid='public.restaurants'::regclass and a.attnum>0 and not a.attisdropped loop
      if pg_catalog.has_column_privilege(api_role,'public.restaurants',col.attname,'SELECT') <>
        (col.attname = any(array['id','name','slug','category','short_description','price_level','website_url','instagram_url'])) then
        raise exception 'Unexpected restaurant column SELECT privilege';
      end if;
      if pg_catalog.has_column_privilege(api_role,'public.restaurants',col.attname,'INSERT,UPDATE,REFERENCES') then
        raise exception 'Unexpected restaurant column write privilege';
      end if;
    end loop;
  end loop;
  if not (select c.relrowsecurity from pg_catalog.pg_class c where c.oid='public.restaurants'::regclass) then
    raise exception 'Restaurant RLS is disabled';
  end if;
end;
$$;

set local role anon;
do $$
declare restricted_column text;
begin
  perform pg_catalog.set_config('request.jwt.claim.sub','',true);
  perform r.id,r.name,r.slug,r.category,r.short_description,r.price_level,r.website_url,r.instagram_url
    from public.restaurants r;
  if (select count(*) from public.restaurants) <> pg_catalog.current_setting('fooddude.verify_active_count')::bigint then
    raise exception 'Public row count does not match active restaurants';
  end if;
  if exists(select 1 from public.restaurants r where r.id = any(pg_catalog.current_setting('fooddude.verify_inactive_ids')::uuid[])) then
    raise exception 'Public access exposed an inactive restaurant';
  end if;
  foreach restricted_column in array array['personal_notes','is_favorite','is_active','created_at','updated_at'] loop
    begin
      execute pg_catalog.format('select %I from public.restaurants limit 1',restricted_column);
      raise exception 'Restricted public column was readable';
    exception when insufficient_privilege then null; end;
  end loop;
end;
$$;
reset role;

set local role authenticated;
do $$
declare restricted_column text;
begin
  perform pg_catalog.set_config('request.jwt.claim.sub',pg_catalog.current_setting('fooddude.verify_member'),true);
  if private.is_admin() is not false then raise exception 'Ordinary account incorrectly authorized'; end if;
  perform r.id,r.name,r.slug,r.category,r.short_description,r.price_level,r.website_url,r.instagram_url
    from public.restaurants r;
  if (select count(*) from public.restaurants) <> pg_catalog.current_setting('fooddude.verify_active_count')::bigint then
    raise exception 'Member row count does not match active restaurants';
  end if;
  if exists(select 1 from public.restaurants r where r.id = any(pg_catalog.current_setting('fooddude.verify_inactive_ids')::uuid[])) then
    raise exception 'Member access exposed an inactive restaurant';
  end if;
  foreach restricted_column in array array['personal_notes','is_favorite','is_active','created_at','updated_at'] loop
    begin
      execute pg_catalog.format('select %I from public.restaurants limit 1',restricted_column);
      raise exception 'Restricted member column was readable';
    exception when insufficient_privilege then null; end;
  end loop;
  -- Deliberately invalid arguments ensure these tests cannot alter any record.
  begin
    perform public.admin_update_restaurant(null,null,null,null,null,null,null,null,null,null);
    raise exception 'Member update RPC was not denied';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_create_restaurant(null,null,null,null,null,null,null,null);
    raise exception 'Member create RPC was not denied';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_set_restaurant_active(null,null,null);
    raise exception 'Member status RPC was not denied';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;

select 'PASS exact public metadata grants, active-only visibility, private-field denial, no member writes' as result,
  pg_catalog.current_setting('fooddude.verify_active_count')::bigint as active_restaurants,
  cardinality(pg_catalog.current_setting('fooddude.verify_inactive_ids')::uuid[]) as inactive_restaurants_checked;
rollback;
