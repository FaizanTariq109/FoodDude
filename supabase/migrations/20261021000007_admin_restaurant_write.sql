-- Narrow admin mutations; existing data, grants and policies remain intact.
begin;

create function private.validate_restaurant(
  p_name text, p_slug text, p_category text, p_description text,
  p_price integer, p_website text, p_instagram text, p_active boolean
) returns void language plpgsql set search_path = '' as $$
declare link text;
begin
  if p_name is null or p_name !~ '[^[:space:]]' or char_length(btrim(p_name)) not between 1 and 200
    or p_slug is null or char_length(p_slug) not between 1 and 200
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or p_category is null or p_category not in ('restaurant', 'cafe')
    or char_length(p_description) > 2000
    or p_price not between 1 and 4 or p_active is null then
    raise exception 'Invalid restaurant fields' using errcode = '22023';
  end if;
  foreach link in array array[p_website, p_instagram] loop
    if link is not null and (char_length(link) > 2048
      or link !~ '^https?://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]\\]*)?$') then
      raise exception 'Invalid official URL' using errcode = '22023';
    end if;
  end loop;
end;
$$;
alter function private.validate_restaurant(text,text,text,text,integer,text,text,boolean) owner to postgres;
revoke all on function private.validate_restaurant(text,text,text,text,integer,text,text,boolean)
  from public, anon, authenticated, service_role;

create function public.admin_create_restaurant(
  p_name text, p_slug text, p_category text, p_description text,
  p_price integer, p_website text, p_instagram text, p_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if private.is_admin() is not true then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  perform private.validate_restaurant(p_name,p_slug,p_category,p_description,p_price,p_website,p_instagram,p_active);
  insert into public.restaurants(name,slug,category,short_description,price_level,website_url,instagram_url,is_active)
    values (btrim(p_name),p_slug,p_category,nullif(btrim(p_description),''),p_price,p_website,p_instagram,p_active)
    returning id into result;
  return result;
end;
$$;

create function public.admin_update_restaurant(
  p_id uuid, p_expected_updated_at timestamptz,
  p_name text, p_slug text, p_category text, p_description text,
  p_price integer, p_website text, p_instagram text, p_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare version timestamptz;
begin
  if private.is_admin() is not true then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  perform private.validate_restaurant(p_name,p_slug,p_category,p_description,p_price,p_website,p_instagram,p_active);
  select r.updated_at into version from public.restaurants r where r.id=p_id for update;
  if not found then raise exception 'Restaurant not found' using errcode = 'P0002'; end if;
  if p_expected_updated_at is null or version <> p_expected_updated_at then
    raise exception 'Restaurant changed; reload before saving' using errcode = '40001';
  end if;
  update public.restaurants set name=btrim(p_name),slug=p_slug,category=p_category,
    short_description=nullif(btrim(p_description),''),price_level=p_price,
    website_url=p_website,instagram_url=p_instagram,is_active=p_active where id=p_id;
  return p_id;
end;
$$;

create function public.admin_set_restaurant_active(p_id uuid, p_expected_updated_at timestamptz, p_active boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare version timestamptz;
begin
  if private.is_admin() is not true then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_active is null then raise exception 'Status required' using errcode = '22023'; end if;
  select r.updated_at into version from public.restaurants r where r.id=p_id for update;
  if not found then raise exception 'Restaurant not found' using errcode = 'P0002'; end if;
  if p_expected_updated_at is null or version <> p_expected_updated_at then
    raise exception 'Restaurant changed; reload before saving' using errcode = '40001';
  end if;
  update public.restaurants set is_active=p_active where id=p_id;
  return p_id;
end;
$$;

alter function public.admin_create_restaurant(text,text,text,text,integer,text,text,boolean) owner to postgres;
alter function public.admin_update_restaurant(uuid,timestamptz,text,text,text,text,integer,text,text,boolean) owner to postgres;
alter function public.admin_set_restaurant_active(uuid,timestamptz,boolean) owner to postgres;
revoke all on function public.admin_create_restaurant(text,text,text,text,integer,text,text,boolean),
  public.admin_update_restaurant(uuid,timestamptz,text,text,text,text,integer,text,text,boolean),
  public.admin_set_restaurant_active(uuid,timestamptz,boolean) from public, anon, authenticated, service_role;
grant execute on function public.admin_create_restaurant(text,text,text,text,integer,text,text,boolean),
  public.admin_update_restaurant(uuid,timestamptz,text,text,text,text,integer,text,text,boolean),
  public.admin_set_restaurant_active(uuid,timestamptz,boolean) to authenticated;

commit;
