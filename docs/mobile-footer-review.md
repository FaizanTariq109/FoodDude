# Mobile footer correction — Step 7B.2

Approved release from baseline commit `ba8beba1ddbcd240c63edd8199827e96e8e5d2db`.

## Problem and correction

The mobile body reserved `calc(80px + env(safe-area-inset-bottom))` after the application shell. This inherited the cream body background and created a visible strip below the dark footer.

The reserve now belongs to the footer, after its inner content. Its background reaches the document bottom and extends behind the fixed navigation. The reserve matches the bar's 52px minimum item height, two 8px paddings and 1px border: 69px plus the safe-area inset. Footer and navigation share the same inset value. Existing inner padding keeps contact text and links above the navigation. Removing the old body reserve avoids reserving the same space twice.

All changes are within the existing mobile breakpoint of 900px. Desktop footer layout, full-width background and separate sidebar retain their previous rules. No authentication, data, migrations, settings, new routes or features are changed.

## Verification

Actual local Next.js production-build browser measurements cover:

- Phones: 320×740, 390×844 and 430×932.
- Tablets: 768×1024 and 834×1112.
- Desktop: 1440×900, 1920×1080 and 2560×1440.
- A 390×844 case with a simulated 34px bottom inset in an ignored local review copy.
- The bottom of the long homepage at 390px.

All ten cases have zero body bottom padding, no horizontal overflow, footer edges matching the main application edges and footer bottom matching document bottom within subpixel rounding. The reserve measures 69px without an inset and 103px with the simulated inset; navigation measures approximately 68.8px and 102.8px respectively. Footer content remains at least 24px above the navigation at the page bottom. Desktop has no mobile reserve or mobile bar.

Validate captured browser geometry with:

```powershell
node scripts/check-mobile-footer.mjs <browser-measurements.json>
```

The test consumes actual browser measurements; it does not substitute mocked CSS geometry. Screenshot and measurement artifacts remain local and ignored. The safe-area fixture and synthetic backend are absent from the deployable application. A physical iPhone/Safari check remains useful because the nonzero inset was simulated.

## Release scope and checks

Release files: `src/styles/responsive.css`, `src/styles/polish.css`, `scripts/check-mobile-footer.mjs` and this document. Detailed production-data reconciliation, research, synthetic review harnesses, credentials and `.cache` artifacts are excluded.

Required release checks: the 22 existing offline regressions, performance/UI regression, mobile footer geometry test, lint, typecheck, production build, synthetic-configuration scan and diff checks. After Git deployment, verify the exact commit is READY on the production alias and repeat read-only mobile/desktop smoke checks. No Supabase write or migration is part of this release.
