# Step 8A — private place cover photos

24 October 2026, Asia/Karachi. Local migration and visual approval checkpoint. Migration 013 is **not applied**; the hosted bucket does **not** exist. No hosted photos, user data, Auth settings, policies or public restaurant images were changed. No commit, push or deployment was performed. Production/HEAD remains `a596f8ca9dc83ac0a04e15de56cb20ab314dda88`. Unrelated local research and review work is preserved.

## Implementation

The existing on-demand create/edit dialogs now offer an optional native file picker, local preview, change/clear selection, phased preparation/upload feedback and useful validation errors. The edit dialog shows the saved cover and requires explicit confirmation before scheduling removal on Save. My Places and private places inside private lists display the same cover. Missing or failed images use a warm neutral placeholder with a retry action on failures. Public catalogue photographs and galleries are unchanged.

The picker accepts JPEG, PNG and WebP, including selecting files from a mobile photo library; it does not force camera capture. HEIC/HEIF has an explicit unsupported-format message. Physical-device library/HEIC conversion behavior remains a manual check. File selection by itself never uploads anything.

## Bucket and reference configuration

| Setting | Value |
| --- | --- |
| Bucket | `user-place-photos` |
| Public | **false** |
| Stored MIME allowlist | `image/webp` |
| Stored size cap | 1,048,576 bytes (1MiB) |
| Key | authenticated-owner UUID / server-generated random UUID `.webp` |
| Upload mode | new key; `upsert:false`; cache control `0` |
| Place reference | nullable unique `user_places.photo_object_id`, FK to `storage.objects.id`, ON DELETE RESTRICT |
| Signed URL | 60 seconds; generated and consumed only inside the authenticated image route |

Only the necessary object reference is added to each place. Paths live in Storage metadata; signed URLs are never stored in a row or returned to client components. Existing notes and fields remain independent. The object-reference unique index also supports FK checks/orphan lookups.

Creation uses a stable per-dialog request UUID as the place ID so retries do not create another record or upload. INSERT gains the ID column for this purpose; owner ID remains the existing `auth.uid()` default and is neither insertable nor editable by application users. Place ID remains non-updatable. A collision with another owner's ID cannot overwrite or reveal their row. All owner identity/path decisions come from the verified server session, never form owner fields.

## Storage RLS and database security

- Restrictive guards scope this bucket to the authenticated owner's exact folder and uploader identity, even if an existing permissive Storage policy is broad. An authenticated-only profile guard also denies access after a profile is removed. Keeping that profile check off the anonymous role preserves permissions on unrelated buckets.
- Anonymous requests have no effective access to this bucket. Ordinary application administrators receive the same personal ownership rules as everyone else; there is no admin exception.
- Object UPDATE/overwrite/rename is denied for this bucket. New upload keys are immutable; another user's objects cannot be read, uploaded over, moved or deleted.
- The Storage upload permission probe uses `contentLength`; committed metadata uses `size`. The INSERT guard accepts either bounded numeric representation with WebP MIME, while the place-reference trigger requires completed metadata with an actual size. The bucket independently enforces its MIME/size limits through the Storage API.
- The invoker trigger checks that any attached object exists, is in this bucket, has the caller/place owner, follows the canonical path and has valid completed MIME/size metadata. Forged, cross-owner and incomplete references fail. A unique FK prevents object reuse by two places.
- `get_user_place_photo(place_id)` is a fixed-path **SECURITY INVOKER** function. It returns the current object path only for the caller's own place, under both tables' RLS. Storage is not added to PostgREST's exposed schemas. Anonymous and service-role execution are revoked; authenticated execution is allowed.
- No new SECURITY DEFINER function, service-role key, arbitrary user-ID authorization, global private-data cache or public image bucket is introduced. Existing catalogue/list/like/profile policies and functions are unchanged.

Read-only hosted metadata confirms `storage.objects` RLS is enabled, its required columns have the expected types, and the authenticated role already has the schema/SELECT access required by the invoker function. The proposed bucket is absent. No hosted object records or private photo contents were read for this inspection.

## Image validation and processing

Browser preprocessing accepts source files up to 10MiB, checks MIME/signature, decodes through ImageBitmap/canvas, preserves aspect ratio and downsizes to a maximum of 1600px. It targets WebP under 960KB before transmitting. Temporary preview object URLs are revoked when replaced/unmounted.

The server independently checks type and magic bytes, rejects empty/oversize inputs and decodes the entire image with Sharp (`failOn:warning`, maximum 40 million input pixels). JPEG, PNG and WebP only; invalid/truncated/unsupported content fails. It applies orientation, resizes within 1600×1600 without enlargement and re-encodes WebP with bounded quality attempts to remain within 1MiB. Default Sharp output drops EXIF and other unnecessary metadata. Sharp 0.35.5 is now an explicit pinned dependency; it was already present transitively. No paid transformation service is used.

The Server Action body allowance is 2MiB, leaving room for a compressed image and multipart/text fields. Large originals are processed in the browser before the action is called; no 10MiB body is sent to the action.

Storage RLS and MIME metadata do not decode image bytes. A malicious owner could invoke Storage directly with forged MIME metadata; that does not bypass ownership. To protect application delivery as well, the authenticated image route decodes and re-encodes the fetched object before returning WebP. Arbitrary bytes are never forwarded as an application photo.

## Upload, replace, remove and delete lifecycle

| Operation | Ordering and failure behavior |
| --- | --- |
| Create with cover | Validate/encode → upload new unique key → insert place with completed object reference. Stable creation UUID makes retries idempotent. |
| Create without cover | Insert normal private place with a null photo reference. |
| Replace | Read owned current version/path → validate/encode/upload new object → update using exact `updated_at` compare-and-set → remove old object via Storage API. |
| Remove | Explicit confirmation → compare-and-set reference to null → remove old object via Storage API. |
| Delete place | Existing confirmation and version check → delete owned place and cascade its private-list memberships → remove former photo via Storage API. |
| Upload failure | Existing place/photo remains unchanged. Any known unused new upload gets a best-effort cleanup. |
| Stale/concurrent edit | Compare-and-set returns no row; the new unused upload is cleaned up and the old reference is not touched. Reload is requested. |
| Unknown commit outcome | Never undo a committed reference: FK/RLS prevent deleting a referenced object. Retrying the same creation UUID recovers the existing place. |
| Cleanup failure | The successful new reference remains valid. A success message flags pending cleanup; owner review can enumerate unused uploads later. |

The FK is the atomic protection against concurrent attach/delete races; a read-before-delete check alone would be insufficient. No image still referenced by a place can be deleted. Multiple list memberships follow the single place reference. Deleting a place makes new requests to its image route return 404 even if physical cleanup needs retry.

Storage bytes are deleted only through the Storage API, never by SQL deletion of `storage.objects`. The compact Photo storage disclosure reviews only the current owner's prefix and references, pages through results and keeps uploads younger than 24 hours. Cleanup requires confirmation, rechecks through RLS/FK at deletion time and can be repeated safely. No automatic production cleanup is enabled.

The read-only operator audit in `supabase/verification/private_place_photo_orphans.sql` returns aggregate orphan counts, including files without a current profile. It contains no deletion or user/path disclosure. Files left by account removal or external database operations need separately authorized operator cleanup; this step does not add an account-deletion job.

## Private image access

`GET /lists/places/[id]/photo` verifies the caller on every request and resolves the current reference through the invoker RPC. It signs for 60 seconds, checks the signed origin/path against configured Supabase, fetches with no redirects and a 10-second timeout, bounds the response to 1MiB, and re-encodes it. Response headers are `private, no-store`, `Vary: Cookie`, `nosniff` and `no-referrer`. Anonymous, cross-owner, stale, invalid and unavailable requests receive an empty private 404.

Client components use an unoptimized image pointing to this protected route, with the object UUID as a version hint. The Next.js shared image optimizer is bypassed. Signed URLs/tokens never enter the browser props, persistent data, logs or screenshots. There is no shared cache of authorization, notes or images. Read/decode work remains per request; lazy image loading limits work to visible cards.

## Tests and actual local browser evidence

PASS: 22 existing offline regression scripts plus performance/UI and mobile footer regressions. Two new photo scripts bring the suite to 26 scripts:

- `check-place-photos-db.mjs`: isolated PostgreSQL with Storage metadata/RLS fixtures; private bucket, preflight/completed metadata, same-owner references, two-user/anonymous isolation, broad-policy defense, unchanged other-bucket access, immutable ownership/identity, duplicate reuse, FK deletion/race protection, stale updates, deleted-place access and unchanged original data/notes/grants/like functions.
- `check-place-photos.mjs`: real Sharp JPEG/PNG/WebP processing, EXIF orientation and removal, dimensions/aspect ratio/size, forged/truncated/empty/oversize/unsupported files; actual actions with isolated Storage transport; create/no-cover, idempotent retries, replacement/removal/deletion, failed upload, stale writes, cleanup/orphan handling and authenticated private image route responses.

PASS: lint, explicit typecheck, normal production Turbopack build and diff checks. The isolated browser-review copy uses Webpack and process-only synthetic environment values; it has no copied real `.env` file. Deployable output is scanned for synthetic endpoints, credentials/test identities and fixtures.

Actual Next.js browser checks used only loopback synthetic data and clearly labelled test-pattern images, never fabricated restaurant photography or production test uploads. Confirmed: native file selection and preview, create/upload pending state, saved decoded 1600px cover, failed replacement preserving the old cover, retry success, removal confirmation and placeholder restoration, cover in a custom list, owner-only unused-photo review and deletion cascading the synthetic membership. A subsequent authenticated HTTP check confirmed the deleted image route is private/no-store 404 and the owner's synthetic Storage listing is empty.

Photo dialog bounds at 320, 390, 430 and 768px have no horizontal overflow in either the dialog or document. Screenshots in ignored `.cache/step8a/`:

- `my-places-desktop.png`, `my-places-mobile.png`: photo and no-photo cards.
- `create-preview-desktop.png`: native selection and small preview.
- `edit-preview-mobile.png`, `remove-confirm-mobile.png`: saved cover and explicit removal confirmation.
- `private-list-cover-mobile.png`: private cover in a saved list.
- `failed-replacement.png`: useful error while retaining the existing photo.

## Approval boundary and remaining checks

Dry-run lists **only** `20261023000013_private_place_photos.sql`, no seeds or roles. No migration or bucket creation was applied, no production photo was uploaded, and no commit/push/deployment was performed.

Actual hosted Storage API integration (including its installed preflight/delete implementation), hosted two-account photo tests and physical iOS/Android library behavior remain post-approval checks. Isolated SQL tests use a representative Storage schema; they are not a running Supabase Storage/S3 stack. The implementation accounts for documented/current preflight metadata and database-first deletion, but the hosted integration cannot be exercised under the current no-bucket/no-upload boundary. Free-plan capacity/egress limits still apply; quota failures return errors and preserve the existing reference. No paid service was introduced.

Sources: [Supabase private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [Storage RLS](https://supabase.com/docs/guides/storage/security/access-control), [Storage metadata/API boundary](https://supabase.com/docs/guides/storage/schema/design), [upstream upload preflight implementation](https://github.com/supabase/storage/blob/master/src/storage/uploader.ts), [upstream deletion ordering](https://github.com/supabase/storage/blob/master/src/storage/object.ts), [Sharp input limits](https://sharp.pixelplumbing.com/api-constructor/), [Sharp output metadata defaults](https://sharp.pixelplumbing.com/api-output/). Current upstream code informs the design; it does not prove the hosted Storage version.

## Full migration 013 SQL

SHA256: `5a63fee9127af03441c84de6fe3f6d33406617b69c70226bb0a536a64df473e4`

```sql
-- Private cover photos. Storage bytes are managed only through the Storage API.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-place-photos', 'user-place-photos', false, 1048576, array['image/webp']);

alter table public.user_places add column photo_object_id uuid
  unique references storage.objects(id) on delete restrict;
-- A stable client request UUID makes creation retries idempotent. Ownership is
-- still the auth.uid() default, checked by existing RLS; neither ID is editable.
grant insert (id, photo_object_id) on public.user_places to authenticated;
grant update (photo_object_id) on public.user_places to authenticated;

-- Restrictive guards also protect this bucket if another bucket has a broad
-- permissive policy. All other buckets retain their original effective rules.
create policy place_photos_owner_guard on storage.objects as restrictive
for all to public
using (bucket_id <> 'user-place-photos' or (
  owner_id = (select auth.uid())::text
  and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]webp$')
))
with check (bucket_id <> 'user-place-photos' or (
  owner_id = (select auth.uid())::text
  and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]webp$')
  and metadata->>'mimetype' = 'image/webp'
  -- Storage's pre-upload permission probe uses contentLength; committed
  -- metadata uses size. Both must obey the same cap.
  and case when coalesce(metadata->>'size', metadata->>'contentLength') ~ '^[0-9]{1,7}$'
    then coalesce(metadata->>'size', metadata->>'contentLength')::integer between 1 and 1048576 else false end
));
-- Keep profile checks off the anonymous role, which has no profile privileges.
create policy place_photos_profile_guard on storage.objects as restrictive
for all to authenticated
using (bucket_id <> 'user-place-photos' or exists (
  select 1 from public.profiles p where p.id = (select auth.uid())
)) with check (bucket_id <> 'user-place-photos' or exists (
  select 1 from public.profiles p where p.id = (select auth.uid())
));
create policy place_photos_no_overwrite on storage.objects as restrictive
for update to public using (bucket_id <> 'user-place-photos')
with check (bucket_id <> 'user-place-photos');

create policy place_photos_read_own on storage.objects for select to authenticated
using (bucket_id = 'user-place-photos' and owner_id = (select auth.uid())::text);
create policy place_photos_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'user-place-photos' and owner_id = (select auth.uid())::text);
create policy place_photos_delete_unused on storage.objects for delete to authenticated
using (bucket_id = 'user-place-photos' and owner_id = (select auth.uid())::text
  and not exists (select 1 from public.user_places p where p.photo_object_id = storage.objects.id));

-- Invoker trigger: the caller must be able to read the exact owned object.
create function public.check_user_place_photo() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.photo_object_id is not null and not exists (
    select 1 from storage.objects o where o.id = new.photo_object_id
      and o.bucket_id = 'user-place-photos'
      and o.owner_id = new.owner_id::text
      and new.owner_id = auth.uid()
      and o.name ~ ('^' || new.owner_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]webp$')
      and o.metadata->>'mimetype' = 'image/webp'
      and case when o.metadata->>'size' ~ '^[0-9]{1,7}$'
        then (o.metadata->>'size')::integer between 1 and 1048576 else false end
  ) then
    raise exception 'Photo unavailable' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.check_user_place_photo() from public, anon, authenticated, service_role;
create trigger check_user_place_photo before insert or update of photo_object_id, owner_id
on public.user_places for each row execute function public.check_user_place_photo();

-- Storage is not added to PostgREST's exposed schemas. Return only the exact
-- caller-owned place's current object path, under both tables' existing RLS.
create function public.get_user_place_photo(p_place_id uuid)
returns table (object_id uuid, object_path text)
language sql stable security invoker set search_path = '' as $$
  select o.id, o.name from public.user_places p join storage.objects o on o.id = p.photo_object_id
  where p.id = p_place_id and p.owner_id = auth.uid()
    and o.bucket_id = 'user-place-photos' and o.owner_id = auth.uid()::text;
$$;
revoke all on function public.get_user_place_photo(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_user_place_photo(uuid) to authenticated;
commit;

```
