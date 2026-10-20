-- Read-only: expect 14 rows, all with table_exists and rls_enabled = true.
-- Missing tables remain visible in the result rather than silently disappearing.
with expected(table_name) as (
  values
    ('restaurants'), ('restaurant_branches'), ('restaurant_images'),
    ('restaurant_recommendations'), ('tags'), ('restaurant_tags'),
    ('banks'), ('bank_cards'), ('scrape_sources'), ('scrape_runs'),
    ('offers'), ('offer_cards'), ('offer_branches'), ('offer_valid_days')
)
select
  expected.table_name,
  c.oid is not null as table_exists,
  coalesce(c.relrowsecurity, false) as rls_enabled
from expected
left join pg_catalog.pg_namespace n on n.nspname = 'public'
left join pg_catalog.pg_class c
  on c.relnamespace = n.oid
  and c.relname = expected.table_name
  and c.relkind in ('r', 'p')
order by expected.table_name;
