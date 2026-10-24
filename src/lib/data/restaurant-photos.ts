import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { cataloguePhoto, type CataloguePhoto, type OfficialPhoto, type RestaurantGallery } from "@/lib/restaurant-photos";

export async function readAdminGallery(client: SupabaseClient, restaurantId: string): Promise<RestaurantGallery> {
  const {data,error}=await client.rpc("admin_restaurant_photos",{p_restaurant_id:restaurantId});
  if(error||!data||typeof data.version!=="string"||!Array.isArray(data.images))throw Error("Photos could not be loaded. Reload before making changes.");
  return data as RestaurantGallery;
}
// One batched, paginated metadata query per catalogue request, never per card.
export async function readPublicPhotos(client: SupabaseClient, ids?: string[], coverOnly=false): Promise<Map<string,CataloguePhoto[]>> {
  const result=new Map<string,CataloguePhoto[]>();
  if(ids&&!ids.length)return result;
  const batches=ids?Array.from({length:Math.ceil(ids.length/100)},(_,index)=>ids.slice(index*100,index*100+100)):[undefined];
  for(const batch of batches){
    for(let offset=0;;offset+=100){
      // Even an administrator browsing the public catalogue must not publish
      // unvalidated legacy locator rows merely because their RLS permits reads.
      let query=client.from("restaurant_images").select("id,restaurant_id,storage_path,alt_text,sort_order,is_cover").not("photo_object_id","is",null);
      if(batch)query=query.in("restaurant_id",batch);
      if(coverOnly)query=query.eq("is_cover",true);
      const {data,error}=await query.order("is_cover",{ascending:false}).order("sort_order").order("id").range(offset,offset+99).abortSignal(AbortSignal.timeout(8_000));
      // Photo failure must not break discovery or resurrect legacy external URLs.
      if(error)return new Map();
      for(const row of data??[]){const photo=cataloguePhoto(getSupabaseEnv().url,row.restaurant_id,row as OfficialPhoto);if(photo)result.set(row.restaurant_id,[...(result.get(row.restaurant_id)??[]),photo]);}
      if((data?.length??0)<100)break;
    }
  }
  return result;
}
