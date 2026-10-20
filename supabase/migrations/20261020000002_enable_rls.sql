-- Apply after 001_initial_schema.sql. No API access is intended at this stage.
begin;

alter table public.restaurants enable row level security;
alter table public.restaurant_branches enable row level security;
alter table public.restaurant_images enable row level security;
alter table public.restaurant_recommendations enable row level security;
alter table public.tags enable row level security;
alter table public.restaurant_tags enable row level security;
alter table public.banks enable row level security;
alter table public.bank_cards enable row level security;
alter table public.scrape_sources enable row level security;
alter table public.scrape_runs enable row level security;
alter table public.offers enable row level security;
alter table public.offer_cards enable row level security;
alter table public.offer_branches enable row level security;
alter table public.offer_valid_days enable row level security;

-- Supabase projects can have different default grants. Revoke privileges already
-- attached to these tables, including TRUNCATE (which RLS does not protect).
-- Revoke PUBLIC too, since its privileges are inherited by both API roles.
-- No policies means RLS also defaults to denying row access.
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

-- Future tables must have their access reviewed in their own migrations.
-- This migration deliberately targets only the 14 existing application tables.
commit;
