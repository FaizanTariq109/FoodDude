-- Read-only operator audit AFTER migration 013. Returns counts, never images,
-- object paths, user identities or private place content. Delete bytes only via
-- the Storage API, after separately authorizing any operator cleanup.
begin read only;
select
  count(*) as unreferenced_objects,
  count(*) filter (where o.created_at < now() - interval '24 hours') as older_than_24_hours,
  count(*) filter (where not exists (select 1 from public.profiles p where p.id::text=o.owner_id)) as without_current_profile
from storage.objects o
where o.bucket_id='user-place-photos'
  and not exists (select 1 from public.user_places p where p.photo_object_id=o.id);
rollback;
