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
