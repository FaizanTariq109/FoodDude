"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { listSession } from "@/lib/data/lists";
import { currentPhoto, discardPhoto, unusedPhotos } from "@/lib/data/place-photos";
import { listId, listText, type ListState } from "@/lib/lists";
import { googleMapsUrl } from "@/lib/user-places";
import { PHOTO_BUCKET } from "@/lib/place-photo";
import { processPlacePhoto } from "@/lib/process-place-photo";

export async function mutateUserPlace(_previous: ListState, form: FormData): Promise<ListState> {
  let uploaded: string | null = null;
  const session = await listSession().catch(() => null);
  if (!session?.authenticated || !session.userId) return { error: "Please sign in to manage your private places." };
  const {client,userId}=session;
  try {
    const operation = form.get("operation");
    const id = String(operation === "create" ? form.get("creation_id") ?? randomUUID() : form.get("place_id") ?? "");
    if (!listId.test(id)) return { error: "This private place is unavailable. Return to My Places." };
    if (!["create","edit","delete"].includes(String(operation))) return { error:"Unknown place action." };
    let fields;
    if (operation !== "delete") {
      const category = form.get("category");
      if (category !== "restaurant" && category !== "cafe") return { error: "Choose restaurant or cafe." };
      fields = { name: listText(form,"name",120,true)!, category,
        area:listText(form,"area",160),address:listText(form,"address",1000),
        google_maps_url:googleMapsUrl(listText(form,"google_maps_url",2048)),notes:listText(form,"notes",5000) };
    } else if(form.get("confirm")!=="yes") return { error:"Confirm deletion first." };
    const remove = form.get("remove_photo") === "yes";
    if(remove && form.get("confirm_remove_photo")!=="yes")return {error:"Confirm photo removal first."};
    const selected = form.get("photo");
    if(selected!==null && !(selected instanceof File))return {error:"Choose an image file, not a photo URL or text."};
    const file = selected instanceof File && (selected.size || selected.name) ? selected : null;
    if(remove && file)return {error:"Choose replacement or removal, not both."};
    let oldPath: string | null = null;
    let expected: string | null = null;
    if(operation!=="create"){
      const {data:old,error}=await client.from("user_places").select("id,photo_object_id,updated_at").eq("id",id).maybeSingle();
      if(error || !old)return {error:"This private place is unavailable. Return to My Places."};
      expected=String(form.get("expected_updated_at")??"");
      if(!expected || expected!==old.updated_at)return {error:"This place changed in another tab. Reload before saving."};
      if(old.photo_object_id)oldPath=await currentPhoto(client,id);
    }else if(form.get("creation_id")){
      const {data:existing,error}=await client.from("user_places").select("id").eq("id",id).maybeSingle();
      if(error)throw Error();
      if(existing){revalidatePath("/lists","layout");return {success:"Private place already saved."};}
    }
    let objectId: string | null = null;
    if(file && operation!=="delete"){
      const bytes=await processPlacePhoto(file);
      uploaded=`${userId}/${randomUUID()}.webp`;
      const {data,error}=await client.storage.from(PHOTO_BUCKET).upload(uploaded,bytes,{contentType:"image/webp",cacheControl:"0",upsert:false});
      if(error || !data?.id)throw Error("Photo upload failed. Your existing photo has not changed.");
      objectId=data.id;
    }
    let result;
    if(operation==="create")result=await client.from("user_places").insert({id,...fields,photo_object_id:objectId}).select("id").single();
    else if(operation==="edit")result=await client.from("user_places").update({...fields,...(objectId?{photo_object_id:objectId}:remove?{photo_object_id:null}:{})}).eq("id",id).eq("updated_at",expected!).select("id").maybeSingle();
    else result=await client.from("user_places").delete().eq("id",id).eq("updated_at",expected!).select("id").maybeSingle();
    if(result.error || !result.data){
      await discardPhoto(client,userId,uploaded); uploaded=null;
      if(operation==="create" && result.error?.code==="23505"){
        const {data}=await client.from("user_places").select("id").eq("id",id).maybeSingle();
        if(data){revalidatePath("/lists","layout");return {success:"Private place already saved."};}
      }
      return {error:"Unable to save. This place may have changed in another tab. Reload and try again. Unused uploads can be reviewed in photo storage."};
    }
    uploaded=null;
    const clean=await discardPhoto(client,userId,(objectId||remove||operation==="delete")?oldPath:null);
    revalidatePath("/lists","layout");
    return {success:(operation==="delete"?"Private place deleted from My Places and all your lists.":"Private place saved.")+(clean?"":" Photo cleanup is pending. Review unused photos in photo storage.")};
  } catch(error) {
    await discardPhoto(client,userId,uploaded);
    return {error:error instanceof Error && /^(Name|Notes|Description|Area|Address|Google Maps|Use a valid|Invalid text|Photo|Choose|HEIC|Confirm)/.test(error.message)?error.message:"Private places are temporarily unavailable. Please try again. Unused uploads can be reviewed in photo storage."};
  }
}
export async function reviewPlacePhotos(_previous: ListState, form: FormData): Promise<ListState> {
  try {
    const {client,authenticated,userId}=await listSession();
    if(!authenticated||!userId)return {error:"Please sign in to review your photos."};
    const {paths,recent}=await unusedPhotos(client,userId);
    if(form.get("cleanup")!=="yes")return {success:`${paths.length} unused photo(s) older than 24 hours. ${recent} recent upload(s) kept for safety.`};
    if(form.get("confirm")!=="yes")return {error:"Confirm unused-photo cleanup first."};
    let removed=0;
    for(const path of paths)if(await discardPhoto(client,userId,path))removed++;
    return {success:`Reviewed ${paths.length} old unused photo(s); ${removed} cleanup request(s) completed. Referenced and recent photos are kept. Run review again to check remaining objects.`};
  }catch{return {error:"Photo storage could not be reviewed. No place references were changed. Please try again."};}
}
