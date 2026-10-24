import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { readAdminGallery } from "@/lib/data/restaurant-photos";
import { PhotoManagement } from "./photo-management";
export async function RestaurantPhotosSection({restaurantId,restaurantName}:{restaurantId:string;restaurantName:string}){
  await requireAdmin();
  let gallery;
  try{gallery=await readAdminGallery(await createClient(),restaurantId);}
  catch{return <section id="photos" className="admin-panel"><h2>Photos.</h2><p role="alert">Photos could not be loaded. Reload before making changes.</p><a href={`?photos=reload#photos`} className="text-link">Reload photos</a></section>;}
  return <PhotoManagement restaurantId={restaurantId} restaurantName={restaurantName} base={getSupabaseEnv().url} initial={gallery}/>;
}
