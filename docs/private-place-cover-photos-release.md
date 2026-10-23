# Step 8A production release verification

24 October 2026, Asia/Karachi. Approved release of optional private-place cover photos. The historical implementation review, complete SQL and local screenshots are in `private-place-cover-photos-review.md`.

## Migration and data integrity

The linked Supabase project was confirmed as FoodDude (`wtgjwcoinwcivtjtdunn`). Migrations 001–012 were synchronized and the CLI dry-run identified only `20261023000013_private_place_photos.sql`. Its approved SHA256 was verified before applying:

`5a63fee9127af03441c84de6fe3f6d33406617b69c70226bb0a536a64df473e4`

The exact migration applied successfully through the Supabase CLI; migrations 001–013 are now synchronized. The bucket was created by the migration only. No application records or Storage objects were created, changed or removed for testing.

| Aggregate | Before | After migration |
| --- | ---: | ---: |
| Profiles | 4 | 4 |
| Restaurants | 76 | 76 |
| Branches | 9 | 9 |
| Private places | 1 | 1 |
| Private lists | 8 | 8 |
| Memberships | 20 | 20 |
| Nonempty saved-entry notes | 1 | 1 |
| Nonempty personal-place notes | 0 | 0 |
| Bank offers | 0 | 0 |
| Storage objects / bytes | 0 / 0 | 0 / 0 |

Aggregate database-side fingerprints matched for every existing row in these tables, excluding the newly added nullable photo column. Existing public policies, table ACLs/RLS flags, unrelated Storage policies and existing function definitions matched as well. No private note text, email addresses or list contents were exported into this report. Runtime audit files remain ignored locally.

## Hosted security checks

- `user-place-photos`: private, `image/webp` only, maximum 1,048,576 bytes. No attached photos exist at this checkpoint.
- Storage and private-place RLS enabled. Six new policies include restrictive owner/path, profile and no-overwrite guards, without an administrator exception.
- Owner ID remains non-insertable/non-updatable by authenticated application users. Place identity is non-updatable. Photo references have a unique constraint and foreign key with ON DELETE RESTRICT; the invoker validation trigger is installed.
- Both new functions use SECURITY INVOKER and a fixed search path. Anonymous/service-role execution is revoked. Only the reference RPC is executable by authenticated users.
- Hosted read-only role checks: anonymous photo SELECT returned zero rows, photo-column INSERT permission and RPC EXECUTE permission were false. An unrelated synthetic JWT identity returned zero private-place/photo rows and no RPC result. No hosted test identity or data was created.
- Cross-owner writes, forged references, overwrite attempts and referenced-object deletion were exercised in isolated PostgreSQL fixtures. Hosted write/Storage transport behavior remains untested because no production test mutation is authorized.

## Application checks before push

All 26 existing/new regression scripts passed, including isolated photo actions/codecs/RLS, ownership isolation, failure recovery, stale versions and existing lists/likes/auth/admin/catalogue behavior. Mobile footer checks use the previously captured actual-browser geometry. Lint, explicit typecheck, normal Turbopack production build and diff checks passed. All 553 generated production JS/JSON/HTML/CSS files passed the synthetic-configuration scan.

Sharp 0.35.5 is an explicit dependency; the photo route explicitly uses Node.js. Real local Sharp processing passed JPEG/PNG/WebP, orientation/EXIF removal, dimensions, size and invalid input tests. Production module loading and authenticated image processing are separate checks; actual hosted image decoding cannot be claimed without an authorized hosted photo fixture.

Vercel project `food-dude` and production domain `food-dude-eight.vercel.app` were confirmed. Its production URL variable matches the real FoodDude Supabase project. No Vercel environment variables, Auth/SMTP settings or paid services were changed. Research, local review fixtures, screenshots, environment files and unrelated work are excluded from the release commit.

## Post-deployment checks and remaining manual work

The final release report records the exact Git SHA, Vercel READY status and read-only production smoke-test results after push. Do not infer those results from this pre-push document.

Private images are lazy-loaded through an unoptimized same-origin authenticated route. The route returns private/no-store responses and consumes a 60-second signed URL internally; no signed URL is persisted or returned in component props. Current Storage usage is zero; no paid services are introduced. Free-plan quota/egress limits still apply.

After separate authorization, use the owning account to test the actual hosted upload preflight, successful create/replace/remove/delete, failed-upload recovery and concurrent edits, then physical iOS/Android library selection. Do not weaken the reviewed policies if hosted behavior differs. No hosted upload success, image-response timing or physical-device behavior is claimed by the isolated tests. Account-removal orphans require separately authorized cleanup; the included operator SQL is aggregate/read-only only.
