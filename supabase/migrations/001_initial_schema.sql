-- Step 2 only. Apply once to an empty PostgreSQL 15+ / Supabase schema.
-- No auth, RLS policies, grants, storage buckets, or live project setup.
begin;

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category text not null check (category in ('restaurant', 'cafe')),
  short_description text,
  personal_notes text,
  price_level smallint check (price_level between 1 and 4),
  instagram_url text,
  website_url text,
  is_favorite boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.restaurant_branches (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text,
  area text,
  address text,
  latitude numeric(9,6) check (latitude between -90 and 90),
  longitude numeric(9,6) check (longitude between -180 and 180),
  google_maps_url text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, restaurant_id),
  constraint branch_coordinate_pair check ((latitude is null) = (longitude is null))
);

create table public.restaurant_images (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  branch_id uuid,
  storage_path text check (btrim(storage_path) <> ''),
  image_url text check (btrim(image_url) <> ''),
  alt_text text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  constraint image_one_locator check (num_nonnulls(storage_path, image_url) = 1),
  foreign key (branch_id, restaurant_id)
    references public.restaurant_branches(id, restaurant_id) on delete cascade
);

create table public.restaurant_recommendations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  note text,
  recommendation_type text not null default 'general'
    check (recommendation_type in ('food', 'drink', 'ambience', 'service', 'general')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.restaurant_tags (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (restaurant_id, tag_id)
);

create table public.banks (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_path text,
  website_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bank_cards (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references public.banks(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  card_network text,
  card_type text,
  card_tier text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bank_id, slug),
  unique (id, bank_id)
);

create table public.scrape_sources (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid references public.banks(id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  source_url text not null check (btrim(source_url) <> ''),
  scraper_key text not null check (btrim(scraper_key) <> ''),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  scrape_source_id uuid not null references public.scrape_sources(id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  offers_found integer not null default 0 check (offers_found >= 0),
  offers_created integer not null default 0 check (offers_created >= 0),
  offers_updated integer not null default 0 check (offers_updated >= 0),
  error_message text,
  unique (id, scrape_source_id),
  check (completed_at is null or completed_at >= started_at),
  constraint scrape_run_completion check (
    (status = 'running' and completed_at is null)
    or (status <> 'running' and completed_at is not null)
  )
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  offer_type text not null check (offer_type in ('bank', 'restaurant')),
  bank_id uuid references public.banks(id) on delete restrict,
  card_scope text check (card_scope in ('all_bank_cards', 'selected_cards')),
  title text not null check (btrim(title) <> ''),
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed', 'other')),
  discount_value numeric(12,2) check (discount_value >= 0 and discount_value <> 'NaN'::numeric),
  minimum_spend numeric(12,2) check (minimum_spend >= 0 and minimum_spend <> 'NaN'::numeric),
  maximum_discount numeric(12,2) check (maximum_discount >= 0 and maximum_discount <> 'NaN'::numeric),
  currency text not null default 'PKR' check (currency ~ '^[A-Z]{3}$'),
  start_date date,
  expiry_date date,
  terms text,
  source_url text,
  source_name text,
  last_verified_at timestamptz,
  applies_to_all_branches boolean not null,
  applies_every_day boolean not null,
  scrape_source_id uuid references public.scrape_sources(id) on delete restrict,
  last_scrape_run_id uuid,
  external_reference text check (btrim(external_reference) <> ''),
  source_hash text check (btrim(source_hash) <> ''),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, restaurant_id),
  unique (id, bank_id),
  constraint offer_bank_scope check (
    (offer_type = 'bank' and bank_id is not null and card_scope is not null)
    or (offer_type = 'restaurant' and bank_id is null and card_scope is null)
  ),
  constraint offer_percentage_range check (discount_type <> 'percentage' or discount_value <= 100),
  constraint offer_date_order check (expiry_date is null or start_date is null or expiry_date >= start_date),
  constraint offer_scrape_provenance check (
    scrape_source_id is not null
    or (last_scrape_run_id is null and external_reference is null and source_hash is null)
  ),
  foreign key (last_scrape_run_id, scrape_source_id)
    references public.scrape_runs(id, scrape_source_id) on delete restrict
);

create table public.offer_cards (
  offer_id uuid not null,
  card_id uuid not null,
  -- Repeated bank_id enables declarative same-bank integrity; not a domain field.
  bank_id uuid not null,
  primary key (offer_id, card_id),
  foreign key (offer_id, bank_id) references public.offers(id, bank_id) on delete cascade,
  foreign key (card_id, bank_id) references public.bank_cards(id, bank_id) on delete cascade
);

create table public.offer_branches (
  offer_id uuid not null,
  branch_id uuid not null,
  -- Repeated restaurant_id prevents cross-restaurant branch assignments.
  restaurant_id uuid not null,
  primary key (offer_id, branch_id),
  foreign key (offer_id, restaurant_id) references public.offers(id, restaurant_id) on delete cascade,
  foreign key (branch_id, restaurant_id) references public.restaurant_branches(id, restaurant_id) on delete cascade
);

create table public.offer_valid_days (
  offer_id uuid not null references public.offers(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  primary key (offer_id, day_of_week)
);

-- PK/UNIQUE constraints already index slugs and leading junction FK columns.
create index restaurants_name_search_idx on public.restaurants using gin (to_tsvector('simple', name));
create index restaurants_category_idx on public.restaurants(category);
create index restaurant_branches_restaurant_idx on public.restaurant_branches(restaurant_id);
create index restaurant_images_order_idx on public.restaurant_images(restaurant_id, sort_order);
create index restaurant_images_branch_idx on public.restaurant_images(branch_id) where branch_id is not null;
create unique index restaurant_images_cover_idx on public.restaurant_images(restaurant_id) where is_cover;
create index restaurant_recommendations_restaurant_idx on public.restaurant_recommendations(restaurant_id);
create index restaurant_tags_tag_idx on public.restaurant_tags(tag_id);
create index offers_restaurant_idx on public.offers(restaurant_id);
create index offers_type_idx on public.offers(offer_type);
create index offers_active_expiry_idx on public.offers(expiry_date) where is_active;
create index offers_bank_idx on public.offers(bank_id) where bank_id is not null;
create index offers_scrape_source_idx on public.offers(scrape_source_id) where scrape_source_id is not null;
create index offers_scrape_run_idx on public.offers(last_scrape_run_id) where last_scrape_run_id is not null;
create unique index offers_external_reference_idx
  on public.offers(scrape_source_id, restaurant_id, external_reference) where external_reference is not null;
create index offer_cards_card_idx on public.offer_cards(card_id);
create index offer_branches_branch_idx on public.offer_branches(branch_id);
create index scrape_sources_bank_idx on public.scrape_sources(bank_id) where bank_id is not null;
create index scrape_runs_source_started_idx on public.scrape_runs(scrape_source_id, started_at desc);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'restaurants', 'restaurant_branches', 'restaurant_recommendations', 'tags',
    'banks', 'bank_cards', 'offers', 'scrape_sources'
  ] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end;
$$;

-- Touch the parent before junction edits. Concurrent eligibility edits serialize
-- on the offer row (or produce a serialization failure at stricter isolation).
-- Updating a junction key validates both the old and new offer.
create function public.touch_offer_for_scope_change() returns trigger
language plpgsql set search_path = '' as $$
declare old_id uuid; new_id uuid; target_id uuid;
begin
  if tg_op <> 'INSERT' then old_id := old.offer_id; end if;
  if tg_op <> 'DELETE' then new_id := new.offer_id; end if;
  for target_id in select distinct id from unnest(array[old_id, new_id]) as ids(id)
    where id is not null order by id
  loop
    update public.offers set updated_at = clock_timestamp() where id = target_id;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Runs against the final transaction state: create/update an offer and its
-- junction rows together in one transaction. Inactive rows must also be valid.
create function public.check_offer_scope() returns trigger
language plpgsql set search_path = '' as $$
declare current_offer public.offers%rowtype; has_rows boolean;
begin
  select * into current_offer from public.offers where id = new.id;
  if not found then return null; end if; -- Deleted parent, including cascades.

  select exists(select 1 from public.offer_branches where offer_id = new.id) into has_rows;
  if current_offer.applies_to_all_branches = has_rows then
    raise exception 'Offer %: all branches requires no links; selected branches requires at least one', new.id
      using errcode = '23514';
  end if;
  select exists(select 1 from public.offer_valid_days where offer_id = new.id) into has_rows;
  if current_offer.applies_every_day = has_rows then
    raise exception 'Offer %: every day requires no day rows; selected days requires at least one', new.id
      using errcode = '23514';
  end if;
  select exists(select 1 from public.offer_cards where offer_id = new.id) into has_rows;
  if (current_offer.card_scope = 'selected_cards' and not has_rows)
    or (has_rows and (current_offer.card_scope is null or current_offer.card_scope <> 'selected_cards')) then
    raise exception 'Offer %: only selected-card offers require and permit card links', new.id
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger offers_scope_consistency
after insert or update on public.offers deferrable initially deferred
for each row execute function public.check_offer_scope();

-- TRUNCATE bypasses row triggers, so require DELETE for eligibility junctions.
create function public.reject_scope_truncate() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Use transactional DELETE instead of TRUNCATE for offer applicability tables';
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['offer_cards', 'offer_branches', 'offer_valid_days'] loop
    execute format('create trigger touch_offer before insert or update or delete on public.%I for each row execute function public.touch_offer_for_scope_change()', table_name);
    execute format('create trigger reject_truncate before truncate on public.%I for each statement execute function public.reject_scope_truncate()', table_name);
  end loop;
end;
$$;

commit;
