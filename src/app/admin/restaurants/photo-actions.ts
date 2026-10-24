"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { restaurantId } from "@/lib/admin/restaurant-input";
import { readAdminGallery } from "@/lib/data/restaurant-photos";
import { processRestaurantPhoto } from "@/lib/process-restaurant-photo";
import { MAX_RESTAURANT_PHOTOS, RESTAURANT_PHOTO_BUCKET, officialPhotoPath, type RestaurantGallery } from "@/lib/restaurant-photos";
export interface PhotoActionState { error?: string; success?: string; gallery?: RestaurantGallery }

export async function mutateRestaurantPhotos(_previous: PhotoActionState,form: FormData): Promise<PhotoActionState> {
  const client=await createClient();let uploaded:string[]=[];
  const id=String(form.get("restaurant_id")??"");
  const cleanup=async(paths:string[])=>{
    if(!paths.length)return true;
    if(paths.some(p=>!officialPhotoPath(id,p)))return false;
    try{const {data,error}=await client.storage.from(RESTAURANT_PHOTO_BUCKET).remove(paths);return !error&&data?.length===paths.length;}catch{return false;}
  };
  try{
    if(await getAdminAccess(client)!=="admin")return {error:"Administrator access required."};
    if(!restaurantId.test(id))return {error:"Restaurant unavailable."};
    const current=await readAdminGallery(client,id);
    const operation=String(form.get("operation")??"");
    if(operation==="review"||operation==="cleanup"){
      const refs=new Set(current.images.flatMap(p=>[p.storage_path,p.storage_path.replace('/full.webp','/card.webp')]));
      const unused:string[]=[];let recent=0;
      // Storage .list is directory-based: enumerate upload folders, then their files.
      for(let offset=0;;offset+=100){
        const {data,error}=await client.storage.from(RESTAURANT_PHOTO_BUCKET).list(id,{limit:100,offset,sortBy:{column:"name",order:"asc"}});if(error)throw Error();
        for(const folder of data??[]){if(!restaurantId.test(folder.name))continue;
          const {data:files,error:failure}=await client.storage.from(RESTAURANT_PHOTO_BUCKET).list(id+'/'+folder.name,{limit:100});if(failure)throw Error();
          for(const file of files??[]){const path=id+'/'+folder.name+'/'+file.name;if(!officialPhotoPath(id,path)||refs.has(path))continue;const age=Date.now()-Date.parse(file.created_at??"");if(!Number.isFinite(age)||age<86400000)recent++;else unused.push(path);}
        }
        if((data?.length??0)<100)break;
      }
      if(operation==="review")return {gallery:current,success:`${unused.length} old unused file(s); ${recent} recent file(s) kept.`};
      if(form.get("confirm")!=="yes")return {error:"Confirm unused-photo cleanup first."};
      const clean=await cleanup(unused);return {gallery:current,success:clean?"Unused-file cleanup completed. Referenced and recent photos are protected.":"Some cleanup remains pending. Review again; references are protected."};
    }
    if(!["upload","replace","save","remove"].includes(operation))return {error:"Unknown photo action."};
    const imageId=String(form.get("image_id")??"");
    // Stable new image identity recovers creation retries without another upload.
    if(operation==="upload"&&restaurantId.test(imageId)&&current.images.some(p=>p.id===imageId))return {gallery:current,success:"Photo already saved."};
    if(form.get("version")!==current.version)return {error:"Gallery changed in another tab. Reload before saving."};
    let images=current.images.map(p=>({...p}));
    const old=images.find(p=>p.id===imageId);
    if((operation==="replace"||operation==="remove")&&!old)return {error:"Photo unavailable. Reload the gallery."};
    if(operation==="remove"){
      if(form.get("confirm")!=="yes")return {error:"Confirm photo removal first."};
      images=images.filter(p=>p.id!==imageId);
      if(images.length&&!images.some(p=>p.is_cover))images[0].is_cover=true;
    }else if(operation==="save"){
      const edits=JSON.parse(String(form.get("images")??"[]")) as {id:string;alt_text:string;is_cover:boolean}[];
      if(!Array.isArray(edits)||edits.length!==images.length||new Set(edits.map(p=>p.id)).size!==images.length)throw Error("Photo order is invalid.");
      images=edits.map(p=>{const row=current.images.find(r=>r.id===p.id);if(!row||typeof p.alt_text!=="string"||!p.alt_text.trim()||p.alt_text.trim().length>300||typeof p.is_cover!=="boolean")throw Error("Photo description is required (up to 300 characters).");return {...row,alt_text:p.alt_text.trim(),is_cover:p.is_cover};});
    }else{
      if(form.get("publish_permission")!=="yes")return {error:"Confirm you have permission to publish this photo."};
      if(!restaurantId.test(imageId))return {error:"Invalid photo request."};
      if(operation==="upload"&&images.length>=MAX_RESTAURANT_PHOTOS)return {error:"Use up to 12 photos per restaurant."};
      const file=form.get("photo"),alt=String(form.get("alt_text")??"").trim();
      if(!(file instanceof File)||!alt||alt.length>300)return {error:"Choose a photo and enter descriptive alt text (up to 300 characters)."};
      const variants=await processRestaurantPhoto(file),prefix=id+'/'+randomUUID();
      const refs:string[]=[];
      for(const [variant,bytes] of Object.entries(variants)){
        const path=prefix+'/'+variant+'.webp';uploaded.push(path);
        const {data,error}=await client.storage.from(RESTAURANT_PHOTO_BUCKET).upload(path,bytes,{contentType:"image/webp",cacheControl:"3600",upsert:false});
        if(error||!data?.id)throw Error("Photo upload failed. The existing gallery is unchanged.");refs.push(data.id);
      }
      const row={id:imageId,storage_path:prefix+'/full.webp',alt_text:alt,is_cover:old?.is_cover??!images.length,sort_order:old?.sort_order??images.length,photo_object_id:refs[0],thumbnail_object_id:refs[1]};
      images=old?images.map(p=>p.id===imageId?row:p):[...images,row];
    }
    const {data,error}=await client.rpc("admin_save_restaurant_photos",{p_restaurant_id:id,p_expected_version:current.version,p_images:images});
    if(error||!data){await cleanup(uploaded);uploaded=[];return {error:"Gallery could not be saved or changed in another tab. Reload before retrying. Unused uploads can be reviewed below."};}
    uploaded=[];
    const live=new Set(images.map(p=>p.storage_path));
    const removed=current.images.filter(p=>!live.has(p.storage_path)).flatMap(p=>[p.storage_path,p.storage_path.replace('/full.webp','/card.webp')]);
    const clean=await cleanup(removed);
    revalidatePath("/admin","layout");revalidatePath("/","layout");
    return {gallery:data as RestaurantGallery,success:"Photos saved."+(clean?"":" File cleanup is pending. Review unused photos below.")};
  }catch(error){await cleanup(uploaded);return {error:error instanceof Error&&/^(Photo|Choose|HEIC)/.test(error.message)?error.message:"Photos are temporarily unavailable. Reload before retrying; unused uploads can be reviewed below."};}
}
