-- Read-only aggregate audit AFTER migration 014; no paths or user data returned.
-- Actual bytes must be deleted through Storage API, with separate authorization.
begin read only;
select count(*) as unreferenced_files,
  count(*) filter (where o.created_at < now()-interval '24 hours') as older_than_24_hours,
  count(*) filter (where not exists (
    select 1 from public.restaurants r where r.id::text=split_part(o.name,'/',1)
  )) as without_restaurant
from storage.objects o where o.bucket_id='restaurant-photos'
  and not exists (select 1 from public.restaurant_images i
    where i.photo_object_id=o.id or i.thumbnail_object_id=o.id);
rollback;
