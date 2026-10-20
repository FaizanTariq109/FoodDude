-- Allow public clients to read only active restaurants' basic identity fields.
begin;

-- Reassert the closed-by-default state for every application table, including
-- privileges inherited from PUBLIC or Supabase's table-grant defaults.
revoke all privileges on table
  public.restaurants,
  public.restaurant_branches,
  public.restaurant_images,
  public.restaurant_recommendations,
  public.tags,
  public.restaurant_tags,
  public.banks,
  public.bank_cards,
  public.scrape_sources,
  public.scrape_runs,
  public.offers,
  public.offer_cards,
  public.offer_branches,
  public.offer_valid_days
from anon, authenticated, public;

alter table public.restaurants enable row level security;

create policy "Public can read active restaurant basics"
  on public.restaurants
  for select
  to anon, authenticated
  using (is_active is true);

grant select (id, name, slug, category)
  on table public.restaurants
  to anon, authenticated;

commit;
