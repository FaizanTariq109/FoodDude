# Frontend prototype

## Presentation data

`restaurants.seed.ts` is canonical and unchanged. `data/prototype/restaurants.ts` joins optional enrichment to the seed by slug; it never copies the full seed or changes its categories. Sixteen places have illustrative photography, descriptions, tags, example branches, notes and liked items. All remaining entries retain working cards/details with deliberate empty states.

`data/prototype/banks.ts` defines two example card choices. `offers.ts` defines nine unverified promotions: percentage discounts, a fixed PKR discount and restaurant specials. These are demo fixtures, not redeemable offers. Dates are explicit (2026-01-01 through 2027-12-31); the app does not extend them automatically.

## Interactions

- Home submits query parameters to Discover. Quick intent links do the same.
- Browse controls use local React state; changing filters does not rewrite the URL. Refresh restores the original query parameters.
- Different filter fields intersect. Multiple group cards match either card; bank/card selections remain consistent.
- Percentage thresholds never compare a fixed PKR amount with a percentage. Highest percentage sorting likewise excludes fixed amounts from percentage ranking.
- Today uses the Asia/Karachi calendar date, refreshed every minute, and checks weekday plus inclusive validity boundaries. Server markup waits for the client date rather than making a timezone guess.
- Area filtering respects applicable branches. Fuoco demonstrates different offers for its two example branches.
- Likes are session-only and reset on refresh. The seed is never mutated.
- Native dialog provides modal focus containment, Escape dismissal and focus restoration. Mobile filters have a result count and clear/apply controls. Gallery selection and offer terms work with keyboard controls.
- Maps links perform only an explicitly labeled area search. They do not pretend to be verified restaurant directions.
- Collection order is labeled "Last on the list" rather than fabricating timestamps.

## Components and styling

`AppShell`, `PreviewProvider`, `HomeExperience`, `Explorer`, `FilterControls`, `RestaurantCard`, `PhotoFrame`, `FavoriteButton`, `OfferCard`, `RestaurantDetail` and `Modal` provide the reusable UI. Brand constants live in `lib/brand.ts`.

The After Hours visual system uses midnight plum, burgundy, warm cream and apricot, with Fraunces editorial headings, Manrope controls, restrained borders and selective glass. Foundation, homepage, product and responsive CSS are imported by one global entry. Motion respects reduced-motion preferences. Images use next/image with local sources, sizes, alt text and an error fallback.

## Verification

- ESLint and Next/TypeScript checks.
- Production build including 74 generated detail pages.
- `node scripts/check-prototype.mjs`: seed counts, accent-insensitive search, combined bank/percentage filters, OR group-card matching, branch applicability, likes, percentage-vs-fixed semantics, weekdays and validity boundaries.
- Browser review at desktop 1440px, tablet 768px and mobile 390px; search/empty/reset, combined mobile filters, likes, gallery selection, branch changes and expanded terms.
- Production HTTP smoke check across generated public/admin routes and an unknown-slug 404.

## Reference-led refinement next

The current design is a complete direction to critique. Once visual references arrive, revisit typeface choice, mobile card density, hero proportions and photo art direction. Actual restaurant photography should replace the stock images; real verified content should replace demo fixtures in a later integration step. The admin remains a placeholder.

## Illustrative image sources

Local JPEGs in `public/images/prototype` were downloaded from Unsplash's image CDN with `auto=format&fit=crop&w=1600&q=85`. They are stock illustrations, never claims about the named businesses. Source IDs are recorded below for replacement/provenance; no photographer identity is asserted.

| File | Source |
| --- | --- |
| dining-room.jpg | https://images.unsplash.com/photo-1517248135467-4c7edcad34c4 |
| table.jpg | https://images.unsplash.com/photo-1414235077428-338989a2e8c0 |
| bistro.jpg | https://images.unsplash.com/photo-1552566626-52f8b828add9 |
| cafe.jpg | https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb |
| coffee.jpg | https://images.unsplash.com/photo-1442512595331-e89e73853f31 |
| burger.jpg | https://images.unsplash.com/photo-1568901346375-23c9450c58cd |
| pizza.jpg | https://images.unsplash.com/photo-1579751626657-72bc17010498 |
| pasta.jpg | https://images.unsplash.com/photo-1551183053-bf91a1d81141 |


## After Hours visual redesign

FoodDude now uses midnight plum (#211720), elevated plum (#30232D), burgundy (#743347), warm apricot (#EDAD6B), warm cream (#F5EBDF) and terracotta (#D8624C). Semantic tokens in foundation.css control text, borders, surfaces, overlays and focus. No green branding remains.

Fraunces and Manrope are locally hosted through next/font/local. Variable font files and their SIL Open Font Licenses are in src/app/fonts, downloaded from the official google/fonts repository. Builds and visitors do not require a font-provider network request. No npm dependency was added for this redesign.

Desktop uses a compact left navigation rail; tablet/mobile use a branded top bar and safe-area-aware bottom navigation with Discover, Places, Offers and Tonight. Tonight reflects the existing today query parameter. Native dialogs retain keyboard focus behavior.

The home cover layers expressive type with a cinematic image and an integrated dark search surface. Cream deal grids, burgundy group-card selection, horizontal journal entries and staggered dark cafe photography provide distinct section compositions. My Places uses paper-like journal cards; Offers retains clearly labeled bank/restaurant promotions; details use a larger asymmetric gallery.

Verified text contrast ratios: body on cream 13.15:1; muted text on cream 5.05:1; secondary rail text 9.40:1; primary apricot button 8.93:1; burgundy button 8.71:1. Controls use a separate stronger border token and visible focus rings. Reduced-motion handling remains in place.

Reviewed at 1440px desktop, 768px tablet and 390px mobile. Browser checks covered combined bank/percentage filters, Escape/focus restoration, gallery keyboard activation and selection, branch-specific offers, likes, expandable terms and Tonight active state. Original 74 entries, filter engine, session state, domain types, SQL and admin placeholders are preserved. No deployment or backend work is included.
