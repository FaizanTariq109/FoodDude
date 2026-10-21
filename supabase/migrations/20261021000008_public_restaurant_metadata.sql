-- Add only official public metadata; preserve the existing active-only RLS.
begin;

grant select (short_description, price_level, website_url, instagram_url)
  on table public.restaurants
  to anon, authenticated;

commit;
