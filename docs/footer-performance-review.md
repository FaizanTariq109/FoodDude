# Footer and performance review — Step 7B.1

Release update, 23 October 2026: production release and migration 012 were subsequently approved. The migration was applied and integrity/security checks passed before preparing the application release. SMTP and infrastructure regions remain unchanged. The audit below records the measurements and local checkpoint before release; production navigation must be measured independently after deployment.

Reviewed 2026-10-23. Changes remain local and uncommitted. Migration 012 is unchanged and unapplied; no hosted user data, Auth settings or deployment was modified.

## Footer root cause and fix

The outer footer also carried Tailwind's `container` class. Its responsive `max-width` survived the polish stylesheet's `width:100%` override. At wide viewports, the dark background stopped at the capped element, leaving the main content's cream background visible to its right.

The outer `.site-footer` now spans the main content with no max-width. A centered `.footer-inner.container` limits only its content to 1280px. The desktop sidebar remains outside that main content. Existing footer text, navigation, email contact and plum styling remain intact. `.app-content` also explicitly permits flex shrinking with `min-width:0`.

Actual local Next.js browser measurements, CSS pixels:

| Viewport | Previous right gap | Fixed footer left → right | Document client / scroll width |
| --- | ---: | --- | --- |
| 1920×1080 | 184 | 200 → 1920 | 1920 / 1920 |
| 2560×1440 | 824 | 200 → 2560 | 2560 / 2560 |
| 1440×900 | 0 | 200 → 1424.8 | 1425 / 1425 |
| 1366×768 | 0 | 200 → 1351.2 | 1351 / 1351 |
| 390×844 | 0 | 0 → 375.2 | 375 / 375 |

Scrollbar occupancy varies with page height and leaves approximately 15px at the smaller widths; this is the browser scrollbar, not an uncovered content gutter. Footer and app edges match within subpixel rounding in every case. Inner width never exceeds 1280px. Browser-bound assertions pass for all five sizes.

Screenshots and raw measurements are in ignored `.cache/step7b1/`: `footer-2560-full.png`, `footer-1920-full.png`, `footer-mobile.png`, `footer-before.json`, `footer-after.json`. Full-page desktop captures were used because viewport-only captures were scaled/cropped by the browser surface.

## Production observations before any deployment

Read-only navigation used the existing authorized session and its own Liked Places. No list or catalogue mutation was performed.

| Destination | Three click-to-heading observations (ms) |
| --- | --- |
| Discover | 1534, 842, 1471 |
| My Lists | 174, 136, 98 |
| Offers | 1052, 547, 448 |

Opening the account's own Liked Places took 2325ms in one observation. These timings include automation overhead and router/prefetch warmness; they are small samples, not browser performance traces or reliable percentiles.

Anonymous HTTP sampling (three samples per route; network plus server time) gave these HTML TTFB ranges: Discover 331–1387ms, Lists 304–332ms, Offers 342–358ms, Fuoco detail 1421–1906ms. RSC-header request total-duration ranges: Discover 576–993ms, Lists 300–402ms, Offers 309–1105ms, Fuoco 1431–1918ms. The scripted RSC requests omitted router-tree headers and are not exact browser-navigation reproductions. All returned 200; cache headers reported MISS. TTFB is not isolated function CPU time.

The production Discover document referenced nine scripts totaling 637,201 decoded bytes, or 199,290 bytes when recompressed with gzip as an estimate. This is not measured browser transfer size, hydration cost or FCP. The browser automation surface does not expose a usable Performance API; no hydration attribution is claimed.

Read-only platform inspection showed Vercel functions in `iad1` (US East) and FoodDude Supabase in `ap-southeast-2` (Sydney). Response headers included `bom1::iad1`. Geographic separation can contribute to repeated database round trips, but its individual cost was not isolated. A direct agent-to-Supabase public read varied from 354–1253ms and does not measure Vercel-to-Supabase latency. No hosting-region setting changed.

## Controlled local before/after

Two isolated production builds used the same synthetic backend, fixed 50ms delay per database/auth read, and identical synthetic owner data. Three authenticated full-document requests per route excluded browser prefetch traffic. Baseline was frozen before the performance edits; final comparison contains the changes below. No hosted database or real credentials were used for local measurements.

| Route | Before median total ms | After median total ms | Backend requests before / after |
| --- | ---: | ---: | --- |
| Discover | 343.7 | 318.1 | 6 / 6 |
| My Lists | 327.4 | 336.5 | 6 / 6 |
| Offers | 323.9 | 331.5 | 5 / 5 |
| Own private list | 401.9 | 326.1 | 9 / 9 |

The private-list improvement is 75.8ms (18.9%) in this setup, consistent with removing a read waterfall. Small changes on unrelated routes are noise; no improvement is claimed there. Every route retains two auth endpoint requests, representing proxy/render boundaries. Auth helpers and cache behavior were left unchanged after measurement showed no redundant wire requests to remove.

One browser note-save sample per build measured 555ms → 511ms from click to editor closure. Both subsequently displayed the saved text. This is too small a sample, with automation overhead, to establish a reliable speedup; editor closure can precede refreshed text. Earlier text-wait probes matched the textarea and are excluded. Background Link prefetch made per-action request totals unsuitable for precise attribution, so they are not reported as query savings. Production actions were not timed because that would mutate hosted data.

## Implemented optimizations

- After verifying the requested list exists under the caller's RLS session, start its entries, public choices and private-place reads concurrently. Preserve pagination and prior partial-failure semantics.
- Revalidate only the specific private page for note-only edits. Keep broad membership revalidation for add/remove and other list operations so hearts and collection counts remain consistent. Existing explicit refresh behavior remains intact.
- Add `useLinkStatus` feedback within desktop/mobile primary navigation and list-card links. The indicator has screen-reader status text, fixed geometry and reduced-motion support. Keep normal Next Link prefetch behavior.
- Add Discover and Offers loading boundaries; retain existing private-list loading states and mutation pending/error/race protections.

No shared private-data cache, cached admin decision, auth shortcut, RLS change, catalogue caching experiment or speculative region change was introduced. Root-layout liked membership and fresh authorization remain part of the critical path. Further region or server-trace work requires a separately approved deployment/measurement; the local improvement does not mean production has already become faster.

## Validation and preservation

- All 22 existing offline regression scripts passed: 14 app/action/render/auth scripts plus eight isolated PostgreSQL/RLS scripts.
- New `check-performance-ui.mjs` passes: authorization before parallel reads, all reads start before resolution, private DTO preservation, exact note invalidation versus membership invalidation, preserved footer content, accessible pending state, and actual browser bounds at all five widths.
- `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check` passed. The normal Turbopack production build succeeded; no fallback was necessary.
- Production output is checked for local synthetic endpoints, keys and identities; audit/build copies remain ignored and separate from the real app configuration.
- Preserved Step 7B core source hashes are compared against the pre-audit manifest. Migration 012 SHA256 remains `90e47b47eb8e7069c7744ecde60678be07b37004a160ca5b272cbc3fdc261a78`.
- Existing owner isolation, cross-owner reference denial, anonymous restrictions, custom-place cascade, private notes, duplicate prevention, inactive restaurants, likes and catalogue/admin regressions passed in isolated PostgreSQL.

Changed areas for this audit: app shell/footer and polish CSS; new LinkPending and Discover/Offers loading components; list-detail read orchestration; note revalidation; link indicators in overview; test mocks plus new performance regression; this report and the email report. Other uncommitted Step 7B and historical research/documentation files are preserved.

## Remaining limitations / review checkpoint

SMTP subject/template and received-message authentication require manual inspection; see `email-deliverability-review.md`. Hydration and per-query production server traces are unavailable from the present browser surface. Hosted mutations were intentionally excluded. No blocker prevents local review. Approve the visuals and migration separately before any migration apply, commit, push or deployment.
