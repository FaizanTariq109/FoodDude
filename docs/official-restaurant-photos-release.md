# Step 8B production release

24 October 2026. Owner approved release of the reviewed official restaurant photo implementation. This records the release preflight and hosted migration verification; the earlier review document remains a historical local approval checkpoint.

## Approved migration and target

- FoodDude Supabase project: `wtgjwcoinwcivtjtdunn`.
- Migration: `20261024000014_official_restaurant_photos.sql`.
- SHA256: `88822456cb26e6be462413568d16e097d618fc10a3873e6764982b68d0a9f247` (unchanged from approval).
- Production baseline commit: `0eb022d067b70556456143d77108aeb0f0ac93d2`.
- Dry-run listed only 014; CLI applied it successfully. Migrations 001–014 now match locally/remotely; subsequent dry-run reports up to date.

## Hosted read-only verification

The new `restaurant-photos` bucket is public, WebP-only, with a 1,048,576-byte object limit. Existing private bucket configuration, all prior Storage/public/private policies, prior table ACL/RLS and public/private function definitions matched the pre-migration baseline. Restaurant image RLS, restrictive Storage guards, least-column read grants, denial of direct image mutations, cover uniqueness, restrictive object foreign keys, full/card validation and database-backed admin RPC authorization were inspected on the hosted database.

Anonymous role checks deny private list/entry reads and gallery RPC execution. An unrelated authenticated identity has no administrator membership; the gallery read RPC rejects it. Cross-restaurant attachments, object writes/deletes, paired variants, stale saves and cleanup races are exercised in isolated database/action tests; production write attempts are deliberately excluded.

All eight table fingerprints and private-note fingerprints matched before and after migration:

| Records | Count |
| --- | ---: |
| Restaurants | 76 |
| Branches | 9 |
| Restaurant images | 0 |
| Profiles | 4 |
| Private places | 1 |
| User lists | 8 |
| Saved entries | 20 |
| Offers | 0 |

Storage buckets increased from 1 to 2 as authorized; existing bucket fingerprints were unchanged. Storage objects remain zero. Fingerprints are database-side aggregates; no private note text, emails or list content is published in this report. No production restaurant, branch, user, list, membership or photo records were changed for testing.

## Release validation

All 28 current regression scripts passed, including the two official photo suites and existing private-photo, authentication, admin, public catalogue, lists, likes, private places and mobile footer coverage. Lint, typecheck, Next.js production Turbopack build and diff whitespace checks passed. A scan of 558 generated application files found no synthetic endpoints, fixture names, test identities or credential patterns. Only official-photo implementation, migration, tests and these non-sensitive documents are included in this commit; unrelated research and work remain local.

## Operational limits and remaining manual checks

No hosted photo upload, replacement, reordering, removal or cleanup was performed. Those flows passed isolated tests and local actual Next.js browser review; real hosted Storage upload/delete remains a later separately authorized test using a licensed restaurant photo. Step 8A private-photo hosted upload testing remains explicitly deferred and its bucket was not mutated.

Public URL delivery remains independent of restaurant visibility; caches and downloaded copies can outlive removal. Cleanup is explicit, not automatic. Both variants share the existing Supabase Free quota; worst-case 12 full/card pairs consume about 13.875 MiB per restaurant. There is no paid transformation dependency. Card metadata is fetched in batches alongside the catalogue; pre-generated 640px/160KiB and 1600px/1MiB WebP files are delivered directly, with responsive sizing and lazy loading. High-DPR cards can choose the full variant. No production region change is included. With zero hosted official photos, production image delivery performance cannot yet be measured.

Production READY/SHA, alias, runtime logs, final data fingerprints and read-only browser smoke results are reported separately after this Git-triggered release completes.
