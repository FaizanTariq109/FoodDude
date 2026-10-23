import "server-only";
import { PHOTO_BUCKET } from "@/lib/place-photo";
import type { listSession } from "./lists";
type Client = Awaited<ReturnType<typeof listSession>>["client"];
export function ownedPhotoPath(userId: string, path: string) {
  return path.startsWith(userId + "/") && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(path);
}
export async function currentPhoto(client: Client, placeId: string): Promise<string | null> {
  const { data, error } = await client.rpc("get_user_place_photo", { p_place_id: placeId });
  if (error) throw Error("Photo reference could not be loaded. Please reload and try again.");
  return data?.[0]?.object_path ?? null;
}
export async function discardPhoto(client: Client, userId: string, path: string | null): Promise<boolean> {
  if (!path) return true;
  if (!ownedPhotoPath(userId,path)) return false;
  try { const { data, error } = await client.storage.from(PHOTO_BUCKET).remove([path]); return !error && !!data?.length; }
  catch { return false; }
}
export async function unusedPhotos(client: Client, userId: string) {
  const referenced = new Set<string>();
  for (let offset=0; ; offset+=100) {
    const {data,error}=await client.from("user_places").select("photo_object_id").order("id").range(offset,offset+99);
    if(error)throw Error("Unable to review photo storage.");
    for(const row of data)if(row.photo_object_id)referenced.add(row.photo_object_id);
    if(data.length<100)break;
  }
  const paths: string[]=[];
  let recent=0;
  for(let offset=0; ;offset+=100){
    const {data,error}=await client.storage.from(PHOTO_BUCKET).list(userId,{limit:100,offset,sortBy:{column:"name",order:"asc"}});
    if(error)throw Error("Unable to review photo storage.");
    for(const file of data){
      const path=userId+"/"+file.name;
      if(!file.id||referenced.has(file.id)||!ownedPhotoPath(userId,path))continue;
      const created=Date.parse(file.created_at??"");
      if(Date.now()-created<24*60*60*1000||!Number.isFinite(created))recent++;
      else paths.push(path);
    }
    if(data.length<100)break;
  }
  return {paths,recent};
}
