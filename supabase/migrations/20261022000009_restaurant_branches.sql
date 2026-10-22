-- Branch management only. No catalogue rows are inserted, updated or deleted.
begin;

-- The parent subquery deliberately uses its existing active-only RLS policy.
-- Only the already-public id column is needed; no extra parent privileges.
create policy branches_public_active on public.restaurant_branches
  for select to anon, authenticated
  using (is_active is true and exists (
    select 1 from public.restaurants r where r.id = restaurant_branches.restaurant_id
  ));
grant select (id,restaurant_id,name,area,address,phone,google_maps_url,latitude,longitude)
  on public.restaurant_branches to anon, authenticated;

create function public.admin_restaurant_branches(p_restaurant_id uuid)
returns table (
  id uuid, restaurant_id uuid, name text, area text, address text, phone text,
  google_maps_url text, latitude numeric, longitude numeric,
  is_active boolean, created_at timestamptz, updated_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
begin
  if private.is_admin() is not true then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return query select b.id,b.restaurant_id,b.name,b.area,b.address,b.phone,
    b.google_maps_url,b.latitude,b.longitude,b.is_active,b.created_at,b.updated_at
    from public.restaurant_branches b where b.restaurant_id=p_restaurant_id;
end;
$$;

-- Private implementation shared by create/update. Parent row locks serialize
-- duplicate checks for one restaurant, without changing that restaurant's data.
create function private.save_branch(
  p_restaurant_id uuid, p_id uuid, p_expected_updated_at timestamptz,
  p_name text, p_area text, p_address text, p_phone text, p_maps text,
  p_latitude numeric, p_longitude numeric, p_active boolean
) returns uuid language plpgsql set search_path = '' as $$
declare version timestamptz; result uuid;
begin
  if private.is_admin() is not true then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  p_name := nullif(btrim(p_name, E' \t\n\r\f\013'),'');
  p_area := nullif(btrim(p_area, E' \t\n\r\f\013'),'');
  p_address := nullif(btrim(p_address, E' \t\n\r\f\013'),'');
  p_phone := nullif(btrim(p_phone, E' \t\n\r\f\013'),'');
  p_maps := nullif(btrim(p_maps, E' \t\n\r\f\013'),'');
  if coalesce(p_name,p_area,p_address) is null or char_length(p_name)>200
    or char_length(p_area)>200 or char_length(p_address)>1000 or char_length(p_phone)>80
    or p_active is null or ((p_latitude is null) <> (p_longitude is null))
    or p_latitude::text in ('NaN','Infinity','-Infinity')
    or p_longitude::text in ('NaN','Infinity','-Infinity')
    or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Invalid branch fields' using errcode = '22023';
  end if;
  if p_maps is not null and (char_length(p_maps)>2048 or p_maps ~ '[[:space:]\\]'
    or p_maps !~ '^https://((www\.)?google\.com/maps(/[^[:space:]\\]*|[?#][^[:space:]\\]*|$)|maps\.google\.com(/[^[:space:]\\]*|[?#][^[:space:]\\]*|$)|maps\.app\.goo\.gl(/[^[:space:]\\]*|[?#][^[:space:]\\]*|$)|goo\.gl/maps/[^[:space:]\\]*)$') then
    raise exception 'Invalid Google Maps URL' using errcode = '22023';
  end if;
  perform 1 from public.restaurants r where r.id=p_restaurant_id for update;
  if not found then raise exception 'Restaurant not found' using errcode = 'P0002'; end if;
  if p_id is not null then
    select b.updated_at into version from public.restaurant_branches b
      where b.id=p_id and b.restaurant_id=p_restaurant_id for update;
    if not found then raise exception 'Branch not found' using errcode = 'P0002'; end if;
    if p_expected_updated_at is null or version <> p_expected_updated_at then
      raise exception 'Branch changed; reload before saving' using errcode = '40001';
    end if;
  end if;
  -- Exact normalized identity match, including inactive rows. No merging or
  -- global cross-concept matching; different restaurants remain independent.
  if exists (select 1 from public.restaurant_branches b where b.restaurant_id=p_restaurant_id
    and (p_id is null or b.id<>p_id)
    and lower(regexp_replace(btrim(coalesce(b.name,''), E' \t\n\r\f\013'),'[[:space:]]+',' ','g')) = lower(regexp_replace(coalesce(p_name,''),'[[:space:]]+',' ','g'))
    and lower(regexp_replace(btrim(coalesce(b.area,''), E' \t\n\r\f\013'),'[[:space:]]+',' ','g')) = lower(regexp_replace(coalesce(p_area,''),'[[:space:]]+',' ','g'))
    and lower(regexp_replace(btrim(coalesce(b.address,''), E' \t\n\r\f\013'),'[[:space:]]+',' ','g')) = lower(regexp_replace(coalesce(p_address,''),'[[:space:]]+',' ','g'))) then
    raise exception 'Matching branch already exists' using errcode = '23505';
  end if;
  if p_id is null then
    insert into public.restaurant_branches(restaurant_id,name,area,address,phone,google_maps_url,latitude,longitude,is_active)
      values(p_restaurant_id,p_name,p_area,p_address,p_phone,p_maps,p_latitude,p_longitude,p_active)
      returning id into result;
  else
    update public.restaurant_branches set name=p_name,area=p_area,address=p_address,
      phone=p_phone,google_maps_url=p_maps,latitude=p_latitude,longitude=p_longitude,is_active=p_active
      where id=p_id and restaurant_id=p_restaurant_id returning id into result;
  end if;
  return result;
end;
$$;

create function public.admin_create_branch(
  p_restaurant_id uuid, p_name text, p_area text, p_address text, p_phone text,
  p_maps text, p_latitude numeric, p_longitude numeric, p_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if private.is_admin() is not true then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return private.save_branch(p_restaurant_id,null,null,p_name,p_area,p_address,p_phone,p_maps,p_latitude,p_longitude,p_active);
end;
$$;

create function public.admin_update_branch(
  p_restaurant_id uuid, p_id uuid, p_expected_updated_at timestamptz,
  p_name text, p_area text, p_address text, p_phone text, p_maps text,
  p_latitude numeric, p_longitude numeric, p_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if private.is_admin() is not true then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_id is null then raise exception 'Branch required' using errcode = '22023'; end if;
  return private.save_branch(p_restaurant_id,p_id,p_expected_updated_at,p_name,p_area,p_address,p_phone,p_maps,p_latitude,p_longitude,p_active);
end;
$$;

create function public.admin_set_branch_active(
  p_restaurant_id uuid, p_id uuid, p_expected_updated_at timestamptz, p_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare version timestamptz;
begin
  if private.is_admin() is not true then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_active is null then raise exception 'Status required' using errcode = '22023'; end if;
  perform 1 from public.restaurants r where r.id=p_restaurant_id for update;
  if not found then raise exception 'Restaurant not found' using errcode = 'P0002'; end if;
  select b.updated_at into version from public.restaurant_branches b
    where b.id=p_id and b.restaurant_id=p_restaurant_id for update;
  if not found then raise exception 'Branch not found' using errcode = 'P0002'; end if;
  if p_expected_updated_at is null or version <> p_expected_updated_at then
    raise exception 'Branch changed; reload before saving' using errcode = '40001';
  end if;
  update public.restaurant_branches set is_active=p_active where id=p_id and restaurant_id=p_restaurant_id;
  return p_id;
end;
$$;

alter function private.save_branch(uuid,uuid,timestamptz,text,text,text,text,text,numeric,numeric,boolean) owner to postgres;
revoke all on function private.save_branch(uuid,uuid,timestamptz,text,text,text,text,text,numeric,numeric,boolean)
  from public,anon,authenticated,service_role;
alter function public.admin_restaurant_branches(uuid) owner to postgres;
alter function public.admin_create_branch(uuid,text,text,text,text,text,numeric,numeric,boolean) owner to postgres;
alter function public.admin_update_branch(uuid,uuid,timestamptz,text,text,text,text,text,numeric,numeric,boolean) owner to postgres;
alter function public.admin_set_branch_active(uuid,uuid,timestamptz,boolean) owner to postgres;
revoke all on function public.admin_restaurant_branches(uuid),
  public.admin_create_branch(uuid,text,text,text,text,text,numeric,numeric,boolean),
  public.admin_update_branch(uuid,uuid,timestamptz,text,text,text,text,text,numeric,numeric,boolean),
  public.admin_set_branch_active(uuid,uuid,timestamptz,boolean) from public,anon,authenticated,service_role;
grant execute on function public.admin_restaurant_branches(uuid),
  public.admin_create_branch(uuid,text,text,text,text,text,numeric,numeric,boolean),
  public.admin_update_branch(uuid,uuid,timestamptz,text,text,text,text,text,numeric,numeric,boolean),
  public.admin_set_branch_active(uuid,uuid,timestamptz,boolean) to authenticated;

commit;
