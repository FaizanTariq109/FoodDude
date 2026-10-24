# Step 8B — official restaurant photos

24 October 2026, Asia/Karachi. Local implementation and approval checkpoint. No migration, bucket creation, restaurant/branch change, production photo upload/deletion, commit, push or deployment is authorized or performed in this step. Production remains Step 8A, commit `0eb022d067b70556456143d77108aeb0f0ac93d2`. Unrelated research and local work are preserved.

## Existing schema inspection

Read-only hosted inspection confirmed `restaurant_images` exists with RLS enabled, zero rows and no API policies. Its existing columns include restaurant/optional branch identity, mutually exclusive `storage_path`/`image_url`, optional alt text, nonnegative sort order, cover flag and creation time. The restaurant FK cascades; the composite branch FK ensures a branch belongs to the same restaurant. Existing indexes include `(restaurant_id,sort_order)`, partial branch lookup and **unique `(restaurant_id) WHERE is_cover`**. These constraints/indexes are retained.

Anonymous/authenticated API roles currently have no image table privileges. Existing authenticated Storage schema usage and object SELECT/INSERT/DELETE privileges were checked read-only and are present. The new public bucket is absent; private-place storage is unchanged.

Migration 014 reuses this table, adds nullable unique full/card object IDs with restrictive foreign keys to Storage, a pair constraint and an image-only `updated_at` field. Existing image rows are not rewritten or automatically published. Legacy URL/branch rows are preserved and excluded from the new managed gallery. An unexpected legacy cover blocks new managed publication until separately reviewed, rather than silently removing or repurposing it. Isolated tests include a preserved legacy external image.

## Storage and authorization

| Setting | Value |
| --- | --- |
| Bucket | `restaurant-photos` |
| Access | Public file delivery; admin-only metadata listing and mutations |
| Allowed stored MIME | `image/webp` |
| Bucket object limit | 1,048,576 bytes |
| Full image | max dimension 1600px; max 1MiB |
| Card image | max dimension 640px; max 160KiB |
| Keys | restaurant UUID / server random upload UUID / `full.webp` or `card.webp` |
| Cache | 3600 seconds; immutable new keys for replacement |
| Gallery limit | 12 photos per restaurant; exactly one cover when nonempty |

Every server action checks the current verified session through the existing `getAdminAccess`/`current_user_is_admin` infrastructure. Database authorization uses the existing private administrator membership table, not user-supplied IDs or role metadata. No service-role credential is used.

Restrictive Storage guards deny anonymous metadata access and require current database-backed admin membership for this bucket, even in the presence of a broad pre-existing permissive policy. Uploads require the verified uploader identity, canonical restaurant/upload path, WebP MIME and bounded preflight `contentLength` or committed `size`. Object UPDATE/overwrite/rename is prohibited. Admins collectively manage official assets; this is not personal owner storage. All guards leave other bucket rules unchanged. Existing private-place owner isolation is explicitly tested with migration 014 installed, including denying an official administrator access to a different member's private photo.

The reference trigger checks both completed Storage rows, exact bucket, same restaurant prefix and upload pair, MIME, size, nonblank bounded alt text, absence of external URL and absence of branch reassignment. Image/restaurant identity cannot change. Full/card objects cannot be reused by another row. Unique restrictive foreign keys prevent deleting objects that remain referenced, including attach/delete races. Storage bytes are deleted via the Storage API only.

Image table mutations have no direct API grants. Two narrow fixed-search-path SECURITY DEFINER RPCs expose admin gallery reads and atomic saves. Both verify current database-backed membership on every call, are owned by postgres and revoke anonymous/public/service-role execution. This definer boundary is used to keep direct image writes closed while atomically changing a cover across multiple rows and validating Storage references. The trigger remains SECURITY INVOKER. Existing admin, list, like, profile, restaurant and branch policies/functions are not replaced.

Public image table SELECT allows only managed photos whose parent restaurant is visible through existing active-only restaurant RLS. Only required metadata columns are granted; legacy external URLs and branch fields are not public. Public data queries additionally filter managed references even when the caller is an administrator. The photo object UUID is selectable to permit that filter, not as an authorization token.

## Public URLs, removal and inactive restaurants

**Public bucket file delivery bypasses object-read RLS. Anyone with a public URL can continue to retrieve a file independently of catalogue visibility.** Deactivation hides the restaurant and its image metadata from normal public catalogue queries; it does not revoke an already known file URL. Removing a gallery row requests actual deletion of both variants via Storage, but browser/CDN copies can remain cached and downloaded copies cannot be recalled. The upload form, removal confirmation and storage disclosure explain this distinction. No feature claims that changing restaurant visibility makes public photos private. [Supabase public bucket access model](https://supabase.com/docs/guides/storage/buckets/fundamentals).

The admin editor can still manage photos of inactive restaurants. Hard restaurant/branch deletions retain their existing FK behavior; unreferenced bytes are never silently considered deleted. The read-only `supabase/verification/official_restaurant_photo_orphans.sql` reports aggregate unused/aged/missing-parent counts without paths or user data. Files for a deleted parent need separately authorized operator cleanup.

## Upload, concurrency and cleanup

Create/replace forms open on demand, preview multiple selections and require a per-photo description plus confirmation of permission to publish. No files are scraped or automatically downloaded. The browser accepts JPEG/PNG/WebP sources up to 10MiB, checks their type/signature and prepares a bounded WebP before a Server Action. HEIC/HEIF gets a clear unsupported-format error. Originals are never stored.

The server independently checks actual bytes and decodes/re-encodes through the existing Sharp pipeline, applies orientation, strips EXIF and other unnecessary metadata, preserves aspect ratio and produces full/card WebP variants. Invalid/truncated/unsupported/animated/oversize inputs fail. Server Actions retain the existing 2MiB request-body limit; each action carries just one compressed source. Batch uploads run sequentially, retain successful earlier photos and report partial failures. Stable row UUIDs avoid duplicating successful creation retries.

Each mutation reads the current gallery and checks its version before processing/uploading. The save RPC locks the restaurant without changing it, compares the version again, validates the complete proposed gallery and atomically changes order, descriptions and cover. Stale edits roll back rather than overwriting another administrator. Only the currently loaded row IDs can be changed through the application metadata editor. Cross-restaurant image IDs and mismatched object pairs also fail inside SQL.

Uploads use new server-generated keys, `upsert:false`, then commit references, then clean old objects. Failed upload or stale save preserves the existing gallery and cleans known unused new objects. If a commit outcome is uncertain, foreign keys prevent cleanup of a successfully attached object. Successful reference changes survive cleanup failures and expose a warning. Replace/remove never delete a currently referenced object. Removing a cover promotes the first remaining photo; an empty gallery is allowed.

The compact storage disclosure reviews only the selected restaurant prefix, pages through upload folders and keeps recent or referenced files. Confirmed cleanup applies only to unused files older than 24 hours. Each API deletion rechecks RLS/FKs. Recent files are kept to protect in-flight uploads. No automatic hosted cleanup is enabled. [Supabase Storage metadata and API boundary](https://supabase.com/docs/guides/storage/schema/design).

## Public display and performance

The same cover reaches homepage/discovery/listing cards, detail covers and related cards through the existing restaurant adapter. Detail pages also receive the ordered gallery. Admin cards use the same public variants. Official photos are labeled as restaurant photos; fallback illustrations retain their explicit illustrative labels. Example areas, notes and offers retain their disclosures even when a restaurant gains genuine photos. The homepage's illustrative hero is unchanged.

Catalogue reads fetch cover metadata in parallel with restaurant records, with pagination and no per-card query. Detail gallery reads are scoped to the requested restaurant. Photo-query failures fall back safely. Public files use responsive `sizes` and a custom image loader choosing the pre-encoded card/full variant. Below-fold images are lazy-loaded; only the principal detail image is preloaded. Public images bypass the Next.js image optimizer and Supabase paid transformations. There is **no per-request public image decode/re-encode**, no public signing RPC and no signed URL in component props. Existing private images continue using their protected non-cacheable route.

## Free-plan capacity implications

Supabase currently documents **1GB shared Storage** on Free and **5GB cached plus 5GB uncached bandwidth**, with database/function/Storage traffic contributing to bandwidth usage. These are shared quotas, not a new photo allowance. [Storage pricing](https://supabase.com/docs/guides/storage/pricing), [bandwidth quotas](https://supabase.com/docs/guides/storage/serving/bandwidth).

Worst case per photo is 1,212,416 bytes across both variants. Five maximum-size photos for each of 76 restaurants would occupy about **461MB / 439MiB**. Twelve maximum-size photos for each would occupy about **1.106GB**, exceeding the nominal Free storage allowance before private files or temporary replacements. Typical compressed graphics are much smaller; these estimates are bounds, not measured restaurant-photo usage. Replacements temporarily require both old and new pairs. Quota/upload failures must preserve the old gallery; per-gallery limits do not reserve organization-wide free capacity. Review usage and unused files before bulk publication. No plan change or paid service is introduced.

## Validation and approval checkpoint

The 26 previous regression scripts and two new official-photo suites pass (28 total). New suites exercise real isolated PostgreSQL/RLS, public/anon/non-admin restrictions, database-backed admin RPC checks, private-photo regression with 014 installed, forged/cross-restaurant references, committed-vs-preflight metadata, unique cover, immutable objects, stale versions, reordering, descriptions, reference-protected deletion, real Sharp codecs/limits/EXIF, application action failures/retries/cleanup and cover/fallback rendering. Isolated Storage transport is simulated; it is not a running hosted Supabase Storage/S3 stack.

Lint, explicit typecheck, production build, final diff/build-artifact scan and local browser evidence are recorded with the final checkpoint. The synthetic app copy has no real environment files; backend and Next.js review run on loopback ports. Test images are clearly labeled synthetic graphics, not fabricated restaurant photography. Browser findings included and corrected the inherited admin-card grid sizing, checkbox sizing and dialog busy-state timing. Local startup was blocked by execution review, so the user started the isolated review app manually; no alternative startup bypass was used.

The Supabase CLI dry-run identifies **only** `20261024000014_official_restaurant_photos.sql`. It has not been applied. The full SQL below is the exact review file. No hosted public bucket, production image mutation, commit, push or deployment occurred.

After approval, hosted Storage preflight/delete integration, CDN removal/cache behavior, real administrative publishing with licensed photos, production timings/egress and physical mobile photo-library behavior still require verification. No hosted upload success is claimed by local tests. Rights to each real photo remain an administrator publishing decision. No public user reviews or unrelated feature work is included.

## Final verified results

- All 28 regression scripts passed. Final focused database checks also reject duplicate UUIDs that differ only in letter case and preserve legacy image rows.
- Lint, explicit typecheck, normal production Turbopack build and diff checks passed. The separate browser-review copy built with Webpack. All 558 deployable JS/JSON/HTML/CSS files passed the synthetic-configuration scan.
- Actual Next.js browser: batch upload, previews, cover/order/alt edits, failed replacement preserving the old cover, retry, confirmed removal and unused-file UI; bounded thumbnails and 18px checkboxes; Close disabled and Escape blocked while uploading; a ten-file batch reached the 12-photo cap with one cover; twelve gallery controls wrapped correctly on mobile.
- Photo upload dialogs and public galleries fit 320, 390, 430 and 768px without horizontal overflow. Public gallery keyboard selection, Escape and focus restoration passed. Desktop and mobile captures were reviewed.
- Anonymous public image reads succeeded; anonymous admin navigation led to sign-in; the synthetic non-admin received Access denied. Anonymous likes retained their sign-in prompt. Discover/listing/detail all used the same cover and retained illustrative fallbacks elsewhere. No unexpected browser errors or warnings were observed.
- Local anonymous file delivery decoded as WebP: full 1600×1018 / 11,868 bytes, card 640×407 / 3,304 bytes, both without EXIF and with public max-age=3600. Single loopback samples were 18ms and 13ms. Synthetic document samples were 359ms for /places, 112ms for /discover, 70ms for detail. These measurements do not establish hosted/real-photo performance. High-density displays can select the larger prepared variant; no on-demand transformation is involved.
- Dry-run lists only migration 014. The hosted public bucket remains absent at read-only inspection, existing migrations remain untouched, and HEAD remains the Step 8A release. No index staging, commit, push, deployment or hosted mutation was performed.

## Local screenshot evidence

Final captures and measured responsive bounds are kept under ignored `.cache/step8b/`; the final response links the actual Next.js screenshots. They cover admin gallery, batch preview, order/cover editing, failed replacement, public cards/detail/gallery and mobile states. Screenshots are local review artifacts and are not proposed production assets.

## Full migration 014 SQL

SHA256: `88822456cb26e6be462413568d16e097d618fc10a3873e6764982b68d0a9f247`

```sql
-- Official public photographs. Private-place storage and existing records are unchanged.
begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('restaurant-photos','restaurant-photos',true,1048576,array['image/webp']);

alter table public.restaurant_images
  add column photo_object_id uuid unique references storage.objects(id) on delete restrict,
  add column thumbnail_object_id uuid unique references storage.objects(id) on delete restrict,
  add column updated_at timestamptz not null default now(),
  add constraint official_photo_pair check ((photo_object_id is null) = (thumbnail_object_id is null));
-- Existing locator, branch, order and one-cover constraints/indexes are reused.
grant select (id,restaurant_id,storage_path,alt_text,sort_order,is_cover,updated_at,photo_object_id)
on public.restaurant_images to anon,authenticated;
grant select (thumbnail_object_id) on public.restaurant_images to authenticated;
create policy official_photos_public_read on public.restaurant_images for select to anon,authenticated
using (photo_object_id is not null and exists (
  -- Existing restaurants RLS exposes active rows only; no new column grants.
  select 1 from public.restaurants r where r.id=restaurant_id
));
create policy official_photos_admin_read on public.restaurant_images for select to authenticated
using ((select private.is_admin()));
-- No direct image INSERT/UPDATE/DELETE grants. The atomic RPC below is the writer.

create policy official_objects_identity_guard on storage.objects as restrictive for all to public
using (bucket_id <> 'restaurant-photos' or (select auth.uid()) is not null)
with check (bucket_id <> 'restaurant-photos' or (select auth.uid()) is not null);
create policy official_objects_admin_guard on storage.objects as restrictive for all to authenticated
using (bucket_id <> 'restaurant-photos' or (select private.is_admin()))
with check (bucket_id <> 'restaurant-photos' or (select private.is_admin()));
create policy official_objects_immutable on storage.objects as restrictive for update to public
using (bucket_id <> 'restaurant-photos') with check (bucket_id <> 'restaurant-photos');
create policy official_objects_upload_guard on storage.objects as restrictive for insert to public
with check (bucket_id <> 'restaurant-photos' or (
  owner_id=(select auth.uid())::text
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(full|card)[.]webp$'
  and metadata->>'mimetype'='image/webp'
  and case when coalesce(metadata->>'size',metadata->>'contentLength') ~ '^[0-9]{1,7}$'
    then coalesce(metadata->>'size',metadata->>'contentLength')::integer between 1 and
      case when name like '%/card.webp' then 163840 else 1048576 end else false end
));
create policy official_objects_read on storage.objects for select to authenticated
using (bucket_id='restaurant-photos' and (select private.is_admin()));
create policy official_objects_insert on storage.objects for insert to authenticated
with check (bucket_id='restaurant-photos' and (select private.is_admin()));
create policy official_objects_delete on storage.objects for delete to authenticated
using (bucket_id='restaurant-photos' and (select private.is_admin()) and not exists (
  select 1 from public.restaurant_images i where i.photo_object_id=storage.objects.id or i.thumbnail_object_id=storage.objects.id
));
-- Public bucket URL delivery intentionally bypasses object SELECT RLS. Listing
-- metadata and all mutations require an admin. Deactivation cannot revoke URLs.

create function private.validate_official_photo() returns trigger
language plpgsql security invoker set search_path='' as $$
declare full_name text; card_name text;
begin
  if tg_op='UPDATE' and (new.id<>old.id or new.restaurant_id<>old.restaurant_id) then
    raise exception 'Image identity is immutable' using errcode='42501';
  end if;
  if new.photo_object_id is null then
    raise exception 'Managed Storage references required' using errcode='22023';
  end if;
  select o.name into full_name from storage.objects o where o.id=new.photo_object_id
    and o.bucket_id='restaurant-photos' and o.metadata->>'mimetype'='image/webp'
    and case when o.metadata->>'size' ~ '^[0-9]{1,7}$' then (o.metadata->>'size')::integer between 1 and 1048576 else false end;
  select o.name into card_name from storage.objects o where o.id=new.thumbnail_object_id
    and o.bucket_id='restaurant-photos' and o.metadata->>'mimetype'='image/webp'
    and case when o.metadata->>'size' ~ '^[0-9]{1,6}$' then (o.metadata->>'size')::integer between 1 and 163840 else false end;
  if full_name is null or card_name is null or full_name !~
    ('^'||new.restaurant_id::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/full[.]webp$')
    or card_name<>replace(full_name,'/full.webp','/card.webp')
    or new.storage_path is distinct from full_name or new.image_url is not null or new.branch_id is not null
    or new.alt_text is null or char_length(btrim(new.alt_text)) not between 1 and 300 then
    raise exception 'Invalid official image reference or alt text' using errcode='22023';
  end if;
  new.updated_at=clock_timestamp();
  return new;
end;
$$;
revoke all on function private.validate_official_photo() from public,anon,authenticated,service_role;
create trigger validate_official_photo before insert or update on public.restaurant_images
for each row execute function private.validate_official_photo();

-- Narrow definer boundary: no API role gets direct table mutation privileges.
-- Every call verifies database-backed admin membership; no caller-supplied role.
create function public.admin_restaurant_photos(p_restaurant_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if private.is_admin() is not true then raise exception 'Administrator access required' using errcode='42501'; end if;
  if not exists(select 1 from public.restaurants where id=p_restaurant_id) then
    raise exception 'Restaurant unavailable' using errcode='P0002'; end if;
  select jsonb_build_object('version',md5(coalesce(string_agg(to_jsonb(i)::text,'' order by i.id),'')),
    'images',coalesce(jsonb_agg(jsonb_build_object('id',i.id,'storage_path',i.storage_path,'alt_text',i.alt_text,
      'is_cover',i.is_cover,'sort_order',i.sort_order,'photo_object_id',i.photo_object_id,
      'thumbnail_object_id',i.thumbnail_object_id) order by i.sort_order,i.id),'[]'::jsonb)) into result
    from public.restaurant_images i where i.restaurant_id=p_restaurant_id and i.photo_object_id is not null;
  return result;
end;
$$;

create function public.admin_save_restaurant_photos(p_restaurant_id uuid,p_expected_version text,p_images jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_gallery jsonb; item jsonb; position integer:=0; object_path text;
begin
  if private.is_admin() is not true then raise exception 'Administrator access required' using errcode='42501'; end if;
  -- Lock the parent without changing it; serializes gallery edits and restaurant deletion.
  perform 1 from public.restaurants where id=p_restaurant_id for update;
  if not found then raise exception 'Restaurant unavailable' using errcode='P0002'; end if;
  current_gallery=public.admin_restaurant_photos(p_restaurant_id);
  if p_expected_version is null or p_expected_version is distinct from current_gallery->>'version' then
    raise exception 'Gallery changed; reload before saving' using errcode='40001'; end if;
  if jsonb_typeof(p_images) is distinct from 'array' then raise exception 'Invalid gallery' using errcode='22023'; end if;
  if jsonb_array_length(p_images)>12 or
    (select count(*) from jsonb_array_elements(p_images) x where x->>'is_cover'='true') <> (case when jsonb_array_length(p_images)>0 then 1 else 0 end)
    or (select count(distinct (x->>'id')::uuid) from jsonb_array_elements(p_images) x)<>jsonb_array_length(p_images) then
    raise exception 'Use up to 12 unique photos and one cover' using errcode='22023'; end if;
  if exists(select 1 from public.restaurant_images i join jsonb_array_elements(p_images) x on i.id=(x->>'id')::uuid
    where i.restaurant_id<>p_restaurant_id or i.photo_object_id is null) then
    raise exception 'Image belongs to a different gallery' using errcode='42501'; end if;
  -- Preserve any legacy external/branch rows. Never silently migrate/publish them.
  if exists(select 1 from public.restaurant_images where restaurant_id=p_restaurant_id and photo_object_id is null and is_cover)
    and jsonb_array_length(p_images)>0 then raise exception 'Legacy cover needs separate review' using errcode='22023'; end if;
  delete from public.restaurant_images i where i.restaurant_id=p_restaurant_id and i.photo_object_id is not null
    and not exists(select 1 from jsonb_array_elements(p_images) x where (x->>'id')::uuid=i.id);
  update public.restaurant_images set is_cover=false where restaurant_id=p_restaurant_id and photo_object_id is not null and is_cover;
  for item in select value from jsonb_array_elements(p_images) loop
    select name into object_path from storage.objects where id=(item->>'photo_object_id')::uuid;
    insert into public.restaurant_images(id,restaurant_id,storage_path,alt_text,sort_order,is_cover,photo_object_id,thumbnail_object_id)
    values ((item->>'id')::uuid,p_restaurant_id,object_path,btrim(item->>'alt_text'),position,(item->>'is_cover')::boolean,
      (item->>'photo_object_id')::uuid,(item->>'thumbnail_object_id')::uuid)
    on conflict(id) do update set storage_path=excluded.storage_path,alt_text=excluded.alt_text,sort_order=excluded.sort_order,
      is_cover=excluded.is_cover,photo_object_id=excluded.photo_object_id,thumbnail_object_id=excluded.thumbnail_object_id;
    position=position+1;
  end loop;
  return public.admin_restaurant_photos(p_restaurant_id);
end;
$$;
alter function public.admin_restaurant_photos(uuid) owner to postgres;
alter function public.admin_save_restaurant_photos(uuid,text,jsonb) owner to postgres;
revoke all on function public.admin_restaurant_photos(uuid), public.admin_save_restaurant_photos(uuid,text,jsonb)
from public,anon,authenticated,service_role;
grant execute on function public.admin_restaurant_photos(uuid), public.admin_save_restaurant_photos(uuid,text,jsonb) to authenticated;
commit;

```
