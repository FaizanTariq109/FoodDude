# FoodDude data model — Step 2

This is an unapplied PostgreSQL 15+ / Supabase-compatible schema. The application
still uses structural placeholder pages. No live connection, auth, RLS policies,
CRUD, scraping, storage buckets, or UI changes are included.

## Tables

| Table | Purpose |
| --- | --- |
| `restaurants` | Restaurant/cafe identity, unique URL slug, optional description, personal notes, price level (1–4), links, favorite and active flags. |
| `restaurant_branches` | Optional verified branch details belonging to one restaurant. Coordinates must be a valid latitude/longitude pair or both null. |
| `restaurant_images` | Image metadata for a restaurant, optionally one of its branches. Exactly one storage path or external URL; optional alt text, ordering, and cover flag. No files are stored here. |
| `restaurant_recommendations` | Separate titled food, drink, ambience, service, or general recommendations with optional notes. |
| `tags` | Reusable label identities with unique slugs. No guessed tags are seeded. |
| `restaurant_tags` | Unique restaurant/tag pairs. |
| `banks` | Bank identities, unique slugs, optional logo paths and website links. |
| `bank_cards` | Cards belonging to a bank. Slugs are unique **within the bank**. Network, type, and tier are nullable free text. |
| `offers` | Shared restaurant/bank promotions, discount terms, applicability, verification, and optional scrape provenance. |
| `offer_cards` | Selected eligible cards for an offer; composite primary key `(offer_id, card_id)`. |
| `offer_branches` | Selected eligible branches; composite primary key `(offer_id, branch_id)`. |
| `offer_valid_days` | Selected weekdays; composite primary key `(offer_id, day_of_week)`. |
| `scrape_sources` | Source URL, adapter key, optional associated bank, and active flag. Multiple source pages can use the same adapter key. |
| `scrape_runs` | Run status, times, nonnegative counters, and optional error text for one source. |

All entity IDs are database-generated UUIDs. Junctions use composite primary keys.
Names and titles cannot be blank. Slugs use lowercase ASCII letters/digits and
hyphens. Timestamps use `timestamptz`; creation defaults to `now()`.
`set_updated_at()` maintains update times on every table with `updated_at`.
Images have only the requested creation time; runs have lifecycle timestamps.

```text
restaurants (1) ----< restaurant_branches
     |                     |
     +----< restaurant_images >---- optional branch (same restaurant)
     +----< restaurant_recommendations
     +----< restaurant_tags >---- tags
     |
     +----< offers >---------------- optional bank ---- banks
               |                                         |
               +----< offer_cards >---- bank_cards >------+
               +----< offer_branches >---- restaurant_branches
               +----< offer_valid_days
               |
               +----> optional scrape_sources >---- optional bank
               |                |
               |                +----< scrape_runs
               +----> optional last scrape run (same source)

1 ----< many; >---- reference to one parent
```

## One offer model

Both offer types have the same restaurant, terms, amounts, dates, verification,
source, branch, and weekday concepts. A central table avoids duplicate discovery
queries and inconsistent validation between bank discounts and restaurant deals.

- `offer_type = 'restaurant'`: `bank_id` and `card_scope` are null; no card links.
- `offer_type = 'bank'`: a bank and explicit `card_scope` are required.
- `card_scope = 'selected_cards'`: at least one `offer_cards` row is required.
- `card_scope = 'all_bank_cards'`: no card links; explicitly covers all cards of
  the named bank, including cards added later. Never use this to mean unknown
  eligibility. If only some cards qualify, enumerate them as selected cards.

One bank per bank offer is an intentional initial boundary. Several cards of that
bank can qualify. A promotion spanning banks can be represented by separate offers
for each bank; a future multi-bank campaign model would require a migration.
Do not collapse similar offers from different banks into one row.

`offer_cards.bank_id` is repeated only to support composite foreign keys to both
the offer and card. It prevents cross-bank links, including later reassignment of
referenced entities. It is not duplicated in the public domain representation.

## Branch and weekday applicability

Both booleans are required with **no default**, so every writer must choose:

| Flag | Junction requirement | Meaning |
| --- | --- | --- |
| `applies_to_all_branches = true` | No branch links | All branches of this restaurant, including future branches. |
| `applies_to_all_branches = false` | At least one branch link | Only the listed branches. |
| `applies_every_day = true` | No day rows | Every weekday. |
| `applies_every_day = false` | At least one day row | Only listed weekdays. |

Weekdays are `0 = Sunday`, `1 = Monday`, `2 = Tuesday`, `3 = Wednesday`,
`4 = Thursday`, `5 = Friday`, `6 = Saturday`.

`offer_branches.restaurant_id` supports composite foreign keys to the offer and
branch, preventing a branch from a different restaurant. Images use the same
parent-matching pattern. Every-day/all-branch flags do not override dates, card
eligibility, inactivity, or terms.

The `offers_scope_consistency` deferred constraint trigger checks the **final
transaction state**, including inactive offers. Junction writes touch the parent
offer, triggering that check and updating its timestamp. Parent writes serialize
concurrent eligibility edits; stricter isolation can produce a serialization
failure that a future writer must retry. Writes affecting many offers should lock
them in UUID order and retry deadlocks. Multi-session concurrency still needs
integration testing against the eventual hosted PostgreSQL instance.

Create/update an offer and its junctions in **one transaction**. For example,
changing from all branches to selected branches requires updating the flag and
inserting links before commit. Removing the final selected link requires adding a
replacement, changing scope deliberately, or deleting the offer in that same
transaction. Inactivity alone does not permit incomplete applicability. Incomplete
scraped records must stay outside this canonical table until resolved.

`TRUNCATE` is rejected on eligibility junctions because it bypasses row triggers.
Use transactional `DELETE`; do not disable triggers to bypass integrity checks.
Deferred checks use standard [PostgreSQL constraint triggers](https://www.postgresql.org/docs/17/sql-createtrigger.html).

## Discounts, dates, and unknown values

- `percentage`: nullable decimal value, constrained to 0–100 when supplied.
- `fixed`: nullable nonnegative amount in the offer currency.
- `other`: supports BOGO or other nonnumeric promotions through title/description
  and terms; value may remain null. A nonnull value's meaning must be stated in terms.
- Spend and cap amounts are nullable, nonnegative `numeric(12,2)`; NaN is rejected.
  Null means not recorded, not zero. Zero is a recorded value.
- Currency defaults to `PKR` and accepts a three-letter uppercase code. The format
  check does not validate membership in the ISO currency registry.
- Dates are nullable `date` values. If both exist, expiry must be on/after start.
  Treat endpoints as inclusive and evaluate weekdays/dates in `Asia/Karachi`.
  Null means no recorded bound, not proof that the offer never expires.
- `is_active` is an editorial switch, not a computed guarantee that a promotion
  is currently valid. Future queries must also evaluate dates, applicability,
  active restaurant/branch/card state, and verification freshness.

No offer rows or example business details are seeded. Unknown discount amounts
remain permissible; unknown card/branch/day eligibility must not be guessed.

## Images and recommendations

`storage_path` is a future object key in an application-configured bucket; do not
store expiring signed URLs there. `image_url` allows a verified external image
instead. Exactly one locator is required. There is at most one cover **per
restaurant**, across general and branch images. A restaurant need not have a cover.
Deleting metadata does not delete a future Storage object; storage cleanup needs
separate implementation later. Alt text can be null until supplied.

Recommendations are separate rows, not concatenated notes. The initial kinds use
a text CHECK rather than a PostgreSQL enum, allowing later migration of the
constraint and TypeScript union. Personal notes/favorites currently describe one
owner's collection; this is not a multi-user collection model.

## Future scraper flow and provenance

1. Configure a source URL and `scraper_key`; no adapters are implemented here.
2. Create a `running` run. Terminal `success`, `partial`, or `failed` statuses
   require `completed_at`, which cannot precede `started_at`.
3. Resolve a verified restaurant, bank/cards, branches, and eligibility. Do not
   guess matches or create fake branches to satisfy constraints.
4. Upsert a complete offer and its junctions in a transaction. Record source,
   optional external reference/hash, and optional `last_scrape_run_id`.
5. Update counts and complete the run. Counts are nonnegative; they need not sum
   because sources may include skipped, unchanged, or rejected records.

An offer's run must belong to its declared source. Run/reference/hash fields
require a source. A partial unique index on
`(scrape_source_id, restaurant_id, external_reference)` prevents duplicate source
records **within a restaurant** when a reference is supplied. This accommodates
one bank campaign appearing at several restaurants. Adapters must create a stable
reference that also distinguishes variants at the same restaurant. Null references
allow manual or unresolved source identities; they provide no deduplication.

`source_hash` is nullable, unvalidated opaque text; no hashing is implemented.
`last_scrape_run_id` is latest-write provenance, not a complete offer audit history.
Deleting a restaurant removes its offers but preserves source/run records and
historical counters. `last_verified_at` has no default: importing is not evidence
of verification. `scrape_sources.bank_id` identifies the source owner, not an
eligibility rule; aggregators can have no bank. The offer's bank controls cards.

## Deletion behavior

| Deleted row | Result |
| --- | --- |
| Restaurant | Cascades to its branches, image metadata, recommendations, tag links, offers, and their applicability links. Reusable tags/banks/sources/runs remain. |
| Branch | Deletes branch-specific image metadata and offer-branch links. If it was an offer's last selected branch, resolve that offer in the same transaction or deletion fails. |
| Tag | Deletes restaurant/tag links, not restaurants. |
| Offer | Deletes card, branch, and weekday links. |
| Card | Deletes its offer/card links. Removing the last selected card requires resolving/deleting the affected offer in the same transaction. |
| Bank | Restricted while referenced by offers or scrape sources. Otherwise cascades to its cards. Never deletes restaurant data. Prefer deactivation for historical banks/cards. |
| Scrape source | Restricted while offers or runs refer to it; deactivate to preserve provenance. |
| Scrape run | Restricted if an offer references it. Unreferenced run deletion is possible but is an administrative retention decision. |

UUIDs and parent identity are treated as stable. Composite foreign keys may block
reparenting while links exist; explicitly rebuild the affected relationships.

## Index strategy

Primary/unique keys already index restaurant/bank/tag slugs, bank-scoped card
slugs, and the leading side of junction keys. Additional indexes cover restaurant
category, GIN full-text name search (`simple` configuration), branch/image/
recommendation restaurant IDs, offer restaurant/type/bank, active offer expiry,
reverse junction lookups, and source/run relationships. Full-text searches must
use the indexed `to_tsvector('simple', name)` expression; arbitrary substring or
fuzzy matching is not provided. Active-expiry indexing is partial on `is_active`,
not on a moving current date. No trigram/PostGIS extensions are required.

## Seed and TypeScript mapping

`supabase/seed.sql` inserts only the same 55 restaurant and 19 cafe names,
categories, and existing slugs. UUIDs/timestamps/flags use schema defaults. It uses
`ON CONFLICT (slug) DO NOTHING` so reruns preserve IDs and later edits. A deliberate
slug rename requires seed maintenance to avoid recreating an old slug.

The retained TypeScript seed uses `RestaurantSeed`; its legacy `id` means slug.
It is not a database `Restaurant`. Full domain objects use UUID `id` plus `slug`.
The aliases `UUID`, `ISODate`, `ISODateTime`, and `Decimal` document boundary
formats; they are not runtime validators. Nullable fields remain explicit nulls.
Amounts/coordinates use decimal strings to retain SQL precision; adapters should
convert for calculation/maps deliberately.

Future repository adapters should map SQL snake_case to domain camelCase, validate
data, and hydrate applicability junctions into discriminated unions. An empty
unloaded relation must never be interpreted as all. Selected scopes use nonempty
tuples; database constraints enforce range, uniqueness, and parent matching.
No Supabase-generated DB types or runtime adapters are implemented yet.

## Applying later and Step 3 decisions

The migration is one-time schema DDL, not a repeatable reset script; the seed is
repeatable. Later, on an explicitly approved empty database, apply the migration
before the seed with stop-on-error enabled. Neither is run against a live project
in this step.

No RLS is enabled and no policies, role grants, or auth dependencies are created.
Supabase can expose public-schema tables through its API depending on project
grants. **Do not expose this schema with client credentials before Step 3 defines
RLS and privileges**, especially because `personal_notes` must remain private.
No special SQL is needed merely because RLS is absent. Database constraints are
integrity checks, not access controls; trigger functions use invoker rights.

Before Step 3 decide:

- Single-owner admin versus multiple users; whether favorites/notes need separate
  per-user tables and which restaurant fields the public may read.
- Auth/admin roles, RLS, grants, and how atomic offer/junction writes will execute
  (for example, a controlled transactional RPC).
- Whether all-bank-card scope should include future cards (current model: yes),
  and whether any real campaign needs one offer across multiple banks.
- Image bucket name/access policy, allowed formats, alt-text requirements, and cleanup.
- Verification freshness, scraper identity rules, incomplete-record review, and
  source/run retention. No time-of-day window or immutable offer history exists yet.

## Verification

`scripts/check-schema.mjs` exercises the migration and seed in temporary in-memory
[PGlite](https://pglite.dev/docs/) PostgreSQL. Test records are synthetic and exist
only in memory; they are never added to application seeds or a live database.
PGlite is a temporary verification tool, not an application dependency.

PowerShell setup and execution (no live connection):

```powershell
npm install --prefix "$env:TEMP\fooddude-schema-check" --no-save --package-lock=false @electric-sql/pglite
node scripts/check-schema.mjs "$env:TEMP\fooddude-schema-check\node_modules\@electric-sql\pglite\dist\index.js"
npm run lint
npm run typecheck
npm run build
```

This checks actual SQL execution and constraint behavior, not hosted Supabase
permissions, extensions, connection pooling, multi-session concurrency, or RLS.
