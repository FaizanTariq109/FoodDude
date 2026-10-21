-- Read-only admin catalogue access. Existing table grants and RLS stay unchanged.
begin;

create function public.admin_restaurants() returns table (
  id uuid,
  name text,
  slug text,
  category text,
  short_description text,
  price_level smallint,
  instagram_url text,
  website_url text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.is_admin() is not true then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  return query
    select r.id, r.name, r.slug, r.category, r.short_description, r.price_level,
      r.instagram_url, r.website_url, r.is_active, r.created_at, r.updated_at
    from public.restaurants as r
    order by r.slug;
end;
$$;

alter function public.admin_restaurants() owner to postgres;
revoke all on function public.admin_restaurants()
  from public, anon, authenticated, service_role;
grant execute on function public.admin_restaurants() to authenticated;

commit;
