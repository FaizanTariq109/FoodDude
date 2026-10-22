-- Post-009 owner-run verification. Read-only, no fixtures or row locks.
begin transaction read only;
do $$
declare admin_id uuid; member_id uuid; f record; api_role text; col record;
begin
  select m.user_id into admin_id from private.admin_memberships m limit 1;
  select u.id into member_id from auth.users u where not exists
    (select 1 from private.admin_memberships m where m.user_id=u.id) limit 1;
  if admin_id is null or member_id is null then raise exception 'Admin and ordinary accounts required'; end if;
  perform set_config('fooddude.branch_admin',admin_id::text,true);
  perform set_config('fooddude.branch_member',member_id::text,true);
  perform set_config('fooddude.branch_parent_ids',(select coalesce(array_agg(r.id),'{}'::uuid[])::text from public.restaurants r),true);
  perform set_config('fooddude.branch_all_count',(select count(*)::text from public.restaurant_branches),true);
  perform set_config('fooddude.branch_visible_ids',(select coalesce(array_agg(b.id order by b.id),'{}'::uuid[])::text
    from public.restaurant_branches b join public.restaurants r on r.id=b.restaurant_id where b.is_active and r.is_active),true);
  if not (select c.relrowsecurity from pg_catalog.pg_class c where c.oid='public.restaurant_branches'::regclass) then
    raise exception 'Branch RLS disabled'; end if;
  foreach api_role in array array['anon','authenticated'] loop
    if has_table_privilege(api_role,'public.restaurant_branches','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
      raise exception 'Unexpected table privilege'; end if;
    for col in select attname from pg_catalog.pg_attribute where attrelid='public.restaurant_branches'::regclass and attnum>0 and not attisdropped loop
      if has_column_privilege(api_role,'public.restaurant_branches',col.attname,'SELECT') <>
        (col.attname=any(array['id','restaurant_id','name','area','address','phone','google_maps_url','latitude','longitude']))
        or has_column_privilege(api_role,'public.restaurant_branches',col.attname,'INSERT,UPDATE,REFERENCES') then
        raise exception 'Unexpected column privilege'; end if;
    end loop;
  end loop;
  if (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    and p.proname in ('admin_restaurant_branches','admin_create_branch','admin_update_branch','admin_set_branch_active')) <> 4 then
    raise exception 'Expected four branch RPCs'; end if;
  for f in select p.oid,p.prosecdef,p.proconfig,pg_catalog.pg_get_userbyid(p.proowner) owner
    from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
    and p.proname in ('admin_restaurant_branches','admin_create_branch','admin_update_branch','admin_set_branch_active') loop
    if not f.prosecdef or f.owner<>'postgres' or not ('search_path=""'=any(f.proconfig)) then
      raise exception 'Unexpected function security'; end if;
    foreach api_role in array array['anon','authenticated','service_role'] loop
      if has_function_privilege(api_role,f.oid,'EXECUTE') <> (api_role='authenticated') then
        raise exception 'Unexpected function execute grant'; end if;
    end loop;
  end loop;
end;
$$;
set local role authenticated;
do $$
declare branch_count bigint;
begin
  perform set_config('request.jwt.claim.sub',current_setting('fooddude.branch_admin'),true);
  select count(*) into branch_count from unnest(current_setting('fooddude.branch_parent_ids')::uuid[]) parent(id) cross join lateral public.admin_restaurant_branches(parent.id) b;
  if branch_count<>current_setting('fooddude.branch_all_count')::bigint then raise exception 'Admin read count mismatch'; end if;
  perform public.admin_restaurant_branches(null);
  begin perform public.admin_create_branch(null,null,null,null,null,null,null,null,null);
    raise exception 'Expected validation'; exception when invalid_parameter_value then null; end;
  begin perform public.admin_update_branch(null,null,null,null,null,null,null,null,null,null,null);
    raise exception 'Expected validation'; exception when invalid_parameter_value then null; end;
  begin perform public.admin_set_branch_active(null,null,null,null);
    raise exception 'Expected validation'; exception when invalid_parameter_value then null; end;
end;
$$;
reset role;

set local role anon;
do $$
declare visible uuid[]; restricted text;
begin
  perform set_config('request.jwt.claim.sub','',true);
  select coalesce(array_agg(b.id order by b.id),'{}'::uuid[]) into visible from public.restaurant_branches b;
  if visible<>current_setting('fooddude.branch_visible_ids')::uuid[] then raise exception 'Public branch visibility mismatch'; end if;
  perform b.id,b.restaurant_id,b.name,b.area,b.address,b.phone,b.google_maps_url,b.latitude,b.longitude from public.restaurant_branches b;
  foreach restricted in array array['is_active','created_at','updated_at'] loop
    begin execute format('select %I from public.restaurant_branches limit 1',restricted);
      raise exception 'Private column exposed'; exception when insufficient_privilege then null; end;
  end loop;
  begin perform public.admin_restaurant_branches(null);
    raise exception 'Privileged read allowed'; exception when insufficient_privilege then null; end;
  begin perform public.admin_create_branch(null,null,null,null,null,null,null,null,null);
    raise exception 'Create allowed'; exception when insufficient_privilege then null; end;
  begin perform public.admin_update_branch(null,null,null,null,null,null,null,null,null,null,null);
    raise exception 'Update allowed'; exception when insufficient_privilege then null; end;
  begin perform public.admin_set_branch_active(null,null,null,null);
    raise exception 'Status change allowed'; exception when insufficient_privilege then null; end;
end;
$$;
reset role;

set local role authenticated;
do $$
declare visible uuid[]; restricted text;
begin
  perform set_config('request.jwt.claim.sub',current_setting('fooddude.branch_member'),true);
  select coalesce(array_agg(b.id order by b.id),'{}'::uuid[]) into visible from public.restaurant_branches b;
  if visible<>current_setting('fooddude.branch_visible_ids')::uuid[] then raise exception 'Public branch visibility mismatch'; end if;
  perform b.id,b.restaurant_id,b.name,b.area,b.address,b.phone,b.google_maps_url,b.latitude,b.longitude from public.restaurant_branches b;
  foreach restricted in array array['is_active','created_at','updated_at'] loop
    begin execute format('select %I from public.restaurant_branches limit 1',restricted);
      raise exception 'Private column exposed'; exception when insufficient_privilege then null; end;
  end loop;
  begin perform public.admin_restaurant_branches(null);
    raise exception 'Privileged read allowed'; exception when insufficient_privilege then null; end;
  begin perform public.admin_create_branch(null,null,null,null,null,null,null,null,null);
    raise exception 'Create allowed'; exception when insufficient_privilege then null; end;
  begin perform public.admin_update_branch(null,null,null,null,null,null,null,null,null,null,null);
    raise exception 'Update allowed'; exception when insufficient_privilege then null; end;
  begin perform public.admin_set_branch_active(null,null,null,null);
    raise exception 'Status change allowed'; exception when insufficient_privilege then null; end;
end;
$$;
reset role;

select 'PASS branch read visibility, RPC access, restricted columns and grants; no records changed' as result;
rollback;
