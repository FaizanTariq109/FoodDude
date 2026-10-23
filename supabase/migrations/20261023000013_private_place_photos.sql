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
