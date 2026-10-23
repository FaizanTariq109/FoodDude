# Step 7A UX and persistent Liked Places release

23 October 2026. Release authorized after visual approval of Steps 7A-UX through 7A-UX.4.

## Database

Confirmed FoodDude project `wtgjwcoinwcivtjtdunn`. Before application, migrations 001–010 matched and the CLI dry-run listed only `20261023000011_liked_places.sql`. Its normalized SQL exactly matched the reviewed implementation, SHA256 `632c4f27ebe69f1cf4ac18e0c123c0d82733847163aad7398de9824667834914`. Applied 011 using Supabase CLI. Migrations 001–011 now match and the final dry-run has no pending migrations, roles or seeds.

| Records | Before | After |
| --- | ---: | ---: |
| Profiles | 3 | 3 |
| All user lists | 2 | 5 |
| Custom lists | 2 | 2 |
| Liked Places lists | 0 | 3 |
| Saved entries | 12 | 12 |
| Restaurants | 75 | 75 |
| Branches | 9 | 9 |
| Bank offers | 0 | 0 |

Read-only aggregate fingerprints matched for every existing custom-list row (excluding the new kind column), entry row including private notes, restaurant, branch and offer. Existing lists retain IDs, names, descriptions, timestamps and contents, and now have kind `custom`. Exactly one new correctly named empty default exists per profile; no duplicates or overwritten custom names. No private record contents were returned by the integrity queries.

Hosted metadata confirms both list tables retain owner-only RLS and authenticated-only policies, with no application-admin bypass. Restrictive policies protect default metadata/deletion; column privileges deny owner/kind insert/update. The unique partial index enforces one default per owner. The like RPC uses SECURITY INVOKER and auth.uid(), accepts no owner/list argument, and grants execution only to authenticated clients. The private signup trigger has an empty search_path, postgres ownership, and no API-role execution privilege. Existing unrelated table/column ACLs, policies, RLS settings and functions match the pre-migration snapshot. Anonymous private reads remain denied; existing public projections and restricted catalogue/branch fields retain their permissions.

Two-user/admin isolation, protected defaults, duplicate prevention, private notes, inactive references, and signup initialization were also exercised in isolated SQL tests. No hosted accounts, private lists, notes, or catalogue records were modified for testing. Only the approved migration backfill created hosted collections.

## Application and validation

Approved compact private-list editing, searchable restaurant additions, multi-list saves, persistent hearts, protected Liked Places, navigation, full-width hero, dark footer and responsive sidebar are included. Public `/places` and `/discover` remain available. No sharing, reviews, private restaurant creation or Step 7B features were added.

All 20 regression scripts passed: 13 application scripts and 7 isolated PGlite scripts. Lint, typecheck, production Turbopack build and staged diff checks passed. No Webpack fallback was required. The root build uses the hosted Supabase URL and public publishable key; 289 deployable files were scanned for synthetic transport URLs, fake keys, test identities and secret-key strings, with none found.

Local synthetic full-app browser checks passed for card/detail hearts, pending/error/retry feedback, membership/count refresh, anonymous login prompts and cross-tab consistency. Desktop sidebar fits 1920×1080, 1440×900, 1366×768, 1280×720 and 1280×600 without independent scrolling. Exceptionally short screens retain accessible overflow. Mobile lists/footer/navigation were reviewed at 390×844. Fifteen zoom-equivalent CSS reflow checks passed; actual native-browser zoom remains a manual check.

The release commit excludes unrelated research work, `.gitignore` changes, synthetic review scripts/artifacts, caches and environment files. Release-specific hosted audit JSON/SQL and screenshots stay in ignored `.cache/step7aux-*` files. The completed deployment report is `.cache/step7aux-release-report.md`, which records the exact release SHA, READY deployment and production smoke results after push.

## Remaining authenticated verification

Only an explicitly available owner's session may be used for production read checks. Live heart mutations, custom-list CRUD/private-note editing, a second-device persistence check, and future signup initialization should be checked manually with consenting accounts. Do not access another user's data, create synthetic production accounts, or modify existing user lists/notes to run release tests.
