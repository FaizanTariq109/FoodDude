import { listSession } from "@/lib/data/lists";
import { currentPhoto, ownedPhotoPath } from "@/lib/data/place-photos";
import { listId } from "@/lib/lists";
import { PHOTO_BUCKET, PHOTO_BYTES } from "@/lib/place-photo";
import { processPlacePhoto } from "@/lib/process-place-photo";
import { getSupabaseEnv } from "@/lib/supabase/env";
export const runtime = "nodejs";
const headers={"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
export async function GET(_request: Request,{params}:{params:Promise<{id:string}>}) {
  try{
    const {id}=await params;
    if(!listId.test(id))return new Response(null,{status:404,headers});
    const {client,authenticated,userId}=await listSession();
    if(!authenticated||!userId)return new Response(null,{status:404,headers});
    const path=await currentPhoto(client,id);
    if(!path||!ownedPhotoPath(userId,path))return new Response(null,{status:404,headers});
    const {data,error}=await client.storage.from(PHOTO_BUCKET).createSignedUrl(path,60);
    if(error||!data?.signedUrl)throw Error();
    const url=new URL(data.signedUrl),base=new URL(getSupabaseEnv().url);
    if(url.origin!==base.origin||!url.pathname.startsWith(`/storage/v1/object/sign/${PHOTO_BUCKET}/`))throw Error();
    const response=await fetch(url,{cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10_000)});
    if(!response.ok||!response.body)throw Error();
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>PHOTO_BYTES){await reader.cancel();throw Error();}chunks.push(value);}
    // Never forward arbitrary bytes from an owner's direct Storage uploads.
    const bytes=await processPlacePhoto(new File([new Uint8Array(Buffer.concat(chunks))],"cover.webp",{type:"image/webp"}));
    return new Response(new Uint8Array(bytes),{headers:{...headers,"Content-Type":"image/webp","Content-Disposition":"inline; filename=cover.webp"}});
  }catch{return new Response(null,{status:404,headers});}
}
