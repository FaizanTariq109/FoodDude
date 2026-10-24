"use client";
import Image from "next/image";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from "lucide-react";
import { ListDialog } from "@/components/lists/list-dialog";
import { PhotoFrame } from "@/components/restaurants/restaurant-card";
import { preparePlacePhoto } from "@/lib/prepare-place-photo";
import { cataloguePhoto, MAX_RESTAURANT_PHOTOS, type OfficialPhoto, type RestaurantGallery } from "@/lib/restaurant-photos";
import { mutateRestaurantPhotos, type PhotoActionState } from "@/app/admin/restaurants/photo-actions";

type Selection={id:string;file:File;preview:string;alt:string;done:boolean};
function UploadPhotos({restaurantId,base,gallery,replacing,onResult,close,setBusy}:{restaurantId:string;base:string;gallery:RestaurantGallery;replacing?:OfficialPhoto;onResult:(result:PhotoActionState)=>void;close:()=>void;setBusy:(busy:boolean)=>void}){
  const [selections,setSelections]=useState<Selection[]>([]),[error,setError]=useState(""),[progress,setProgress]=useState("");
  const [pending,start]=useTransition();const prefix=useId();const urls=useRef<string[]>([]);
  useEffect(()=>()=>{urls.current.forEach(url=>URL.revokeObjectURL(url));},[]);
  const submit=(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const form=new FormData(event.currentTarget);
    if(!selections.some(p=>!p.done)){setError("Choose a photo first.");return;}
    setBusy(true);start(async()=>{setError("");let latest=gallery;
      try{
        for(const [index,item] of selections.entries()){
          if(item.done)continue;
          setProgress(`Preparing ${index+1} of ${selections.length}…`);
          const file=await preparePlacePhoto(item.file);
          const data=new FormData();data.set("restaurant_id",restaurantId);data.set("operation",replacing?"replace":"upload");data.set("version",latest.version);
          data.set("image_id",replacing?.id??item.id);data.set("photo",file);data.set("alt_text",item.alt);data.set("publish_permission",form.get("publish_permission")??"");
          setProgress(`Uploading ${index+1} of ${selections.length}…`);
          const result=await mutateRestaurantPhotos({},data);onResult(result);
          if(result.error){setError(result.error);return;}
          latest=result.gallery!;setSelections(old=>old.map(p=>p.id===item.id?{...p,done:true}:p));
        }
        close();
      }catch(error){setError(error instanceof Error&&/^(Photo|Choose|HEIC)/.test(error.message)?error.message:"Photo preparation failed. Choose a supported image.");}
      finally{setProgress("");setBusy(false);}
    });
  };
  const existing=replacing&&cataloguePhoto(base,restaurantId,replacing);
  return <form className="list-form official-photo-upload" onSubmit={submit} aria-busy={pending}><fieldset disabled={pending}>
    <p>Publish only photographs you have permission to use. JPEG, PNG or WebP up to 10MB each. HEIC/HEIF is unsupported.</p>
    {existing&&<div className="admin-photo-preview"><PhotoFrame photo={existing}/><p>Current photo stays until the replacement is saved.</p></div>}
    <label htmlFor={prefix}>Choose {replacing?"replacement":"photos"}</label><input id={prefix} type="file" accept="image/jpeg,image/png,image/webp" multiple={!replacing} required={!selections.length} onChange={event=>{
      const files=Array.from(event.target.files??[]);setError("");
      if(files.length>(replacing?1:MAX_RESTAURANT_PHOTOS-gallery.images.length)){setError("A restaurant can have up to 12 photos. Choose fewer files.");event.target.value="";return;}
      urls.current.forEach(url=>URL.revokeObjectURL(url));
      const chosen=files.map(file=>({id:crypto.randomUUID(),file,preview:URL.createObjectURL(file),alt:replacing?.alt_text??"",done:false}));urls.current=chosen.map(p=>p.preview);setSelections(chosen);
    }}/>
    <div className="photo-selection-list">{selections.map((item,index)=><div className="photo-selection" key={item.id}>
      <Image unoptimized src={item.preview} alt="Selected image preview" width={160} height={100}/><label htmlFor={`${prefix}-${item.id}`}>Description for photo {index+1}<input id={`${prefix}-${item.id}`} required maxLength={300} value={item.alt} disabled={item.done} onChange={event=>{const alt=event.target.value;setSelections(rows=>rows.map(p=>p.id===item.id?{...p,alt}:p));}}/></label>{item.done&&<span>Saved</span>}
    </div>)}</div>
    <label className="admin-checkbox"><input type="checkbox" name="publish_permission" value="yes" required/> I have permission to publish these photos publicly.</label>
    <p className="muted">Public image URLs can remain accessible when a restaurant is inactive, and cached copies can outlive removal.</p>
    {pending&&<p role="status">{progress}</p>}{error&&<p role="alert">{error}</p>}
    <div className="list-form-actions"><button className="button button-dark" disabled={pending}>{pending?"Uploading…":replacing?"Replace photo":"Upload photos"}</button><button type="button" className="button button-outline" disabled={pending} onClick={close}>Cancel</button></div>
  </fieldset></form>;
}

function GalleryControls({initial,restaurantId,onResult,close,setBusy}:{initial:RestaurantGallery;restaurantId:string;onResult:(r:PhotoActionState)=>void;close:()=>void;setBusy:(busy:boolean)=>void}){
  const [rows,setRows]=useState(initial.images),[error,setError]=useState("");const [pending,start]=useTransition();
  const move=(index:number,delta:number)=>setRows(old=>{const list=[...old];[list[index],list[index+delta]]=[list[index+delta],list[index]];return list;});
  return <form className="list-form" onSubmit={event=>{event.preventDefault();setBusy(true);start(async()=>{try{const form=new FormData();form.set("operation","save");form.set("restaurant_id",restaurantId);form.set("version",initial.version);form.set("images",JSON.stringify(rows.map(p=>({id:p.id,alt_text:p.alt_text,is_cover:p.is_cover}))));const result=await mutateRestaurantPhotos({},form);onResult(result);if(result.error)setError(result.error);else close();}catch{setError("Photos could not be saved. Reload before retrying.");}finally{setBusy(false);}});}}>
    <fieldset disabled={pending}><legend className="sr-only">Photo order, cover and descriptions</legend><p>Move photos with the arrow buttons. The cover is used across the catalogue.</p>
      {rows.map((photo,index)=><div className="photo-order-row" key={photo.id}><label>Description for photo {index+1}<input required maxLength={300} value={photo.alt_text} onChange={e=>setRows(old=>old.map(p=>p.id===photo.id?{...p,alt_text:e.target.value}:p))}/></label><div className="photo-order-actions">
        <button type="button" className="icon-button" aria-label={`Move photo ${index+1} up`} disabled={index===0||pending} onClick={()=>move(index,-1)}><ArrowUp size={16}/></button><button type="button" className="icon-button" aria-label={`Move photo ${index+1} down`} disabled={index===rows.length-1||pending} onClick={()=>move(index,1)}><ArrowDown size={16}/></button>
        <label className="admin-checkbox"><input type="radio" name="cover" checked={photo.is_cover} onChange={()=>setRows(old=>old.map(p=>({...p,is_cover:p.id===photo.id})))}/> Cover</label>
      </div></div>)}
      {error&&<p role="alert">{error}</p>}<div className="list-form-actions"><button className="button button-dark">{pending?"Saving…":"Save gallery"}</button><button type="button" className="button button-outline" onClick={close}>Cancel</button></div>
    </fieldset>
  </form>;
}

function RemovePhoto({gallery,image,restaurantId,onResult,close,setBusy}:{gallery:RestaurantGallery;image:OfficialPhoto;restaurantId:string;onResult:(r:PhotoActionState)=>void;close:()=>void;setBusy:(busy:boolean)=>void}){
  const [error,setError]=useState("");const [pending,start]=useTransition();
  return <form className="list-form" onSubmit={event=>{event.preventDefault();setBusy(true);start(async()=>{try{const form=new FormData();form.set("operation","remove");form.set("restaurant_id",restaurantId);form.set("version",gallery.version);form.set("image_id",image.id);form.set("confirm","yes");const result=await mutateRestaurantPhotos({},form);onResult(result);if(result.error)setError(result.error);else close();}catch{setError("Photos could not be saved. Reload before retrying.");}finally{setBusy(false);}});}}><p>Remove this photo from the gallery and request deletion of both stored sizes? Public cached copies may remain accessible for a time. The restaurant and its branches stay intact.</p>{error&&<p role="alert">{error}</p>}<div className="list-form-actions"><button type="button" data-dialog-autofocus className="button button-outline" disabled={pending} onClick={close}>Keep photo</button><button className="button button-dark" disabled={pending}>{pending?"Removing…":"Remove photo"}</button></div></form>;
}

export function PhotoManagement({restaurantId,restaurantName,base,initial}:{restaurantId:string;restaurantName:string;base:string;initial:RestaurantGallery}){
  const [gallery,setGallery]=useState(initial),[message,setMessage]=useState<PhotoActionState>({});const [pending,start]=useTransition();
  const onResult=(result:PhotoActionState)=>{setMessage(result);if(result.gallery)setGallery(result.gallery);};
  return <section id="photos" className="admin-photos" aria-label={`Photos for ${restaurantName}`}><header className="page-intro"><p className="eyebrow">{restaurantName}</p><div className="admin-photo-heading"><h2>Photos.</h2><ListDialog title="Upload restaurant photos" trigger={<><ImagePlus size={16}/>Upload photos</>} disabled={gallery.images.length>=12} triggerClassName="button button-dark">{(close,setBusy)=><UploadPhotos restaurantId={restaurantId} base={base} gallery={gallery} onResult={onResult} close={close} setBusy={setBusy}/>}</ListDialog></div><p>{gallery.images.length} / 12 photos · Public photographs approved for publication.</p></header>
    {message.error&&<p role="alert">{message.error} <a href={`#photos`} onClick={()=>window.location.reload()}>Reload latest gallery</a></p>}{message.success&&<p role="status">{message.success}</p>}
    {!gallery.images.length&&<div className="admin-panel"><p>No official photos yet. Upload photographs you have permission to publish. Public pages keep their labeled fallback.</p></div>}
    <div className="admin-photo-grid">{gallery.images.map((photo,index)=><article className="admin-panel admin-photo-card" key={photo.id}><PhotoFrame photo={cataloguePhoto(base,restaurantId,photo)??undefined}/><div className="admin-photo-caption"><span>{index+1} / {gallery.images.length}</span>{photo.is_cover&&<span className="admin-status"><Star size={12}/> Cover</span>}</div><p>{photo.alt_text}</p><div className="admin-photo-actions"><ListDialog title="Replace restaurant photo" trigger="Replace" triggerClassName="text-link">{(close,setBusy)=><UploadPhotos restaurantId={restaurantId} base={base} gallery={gallery} replacing={photo} onResult={onResult} close={close} setBusy={setBusy}/>}</ListDialog><ListDialog title="Remove restaurant photo?" trigger={<><Trash2 size={13}/>Remove</>} triggerClassName="text-link">{(close,setBusy)=><RemovePhoto restaurantId={restaurantId} gallery={gallery} image={photo} onResult={onResult} close={close} setBusy={setBusy}/>}</ListDialog></div></article>)}</div>
    {!!gallery.images.length&&<ListDialog title="Manage photo order and cover" trigger="Edit descriptions, order & cover">{(close,setBusy)=><GalleryControls initial={gallery} restaurantId={restaurantId} onResult={onResult} close={close} setBusy={setBusy}/>}</ListDialog>}
    <details className="admin-panel photo-maintenance"><summary>Photo storage and visibility</summary><p>Deactivation hides catalogue metadata, not public object URLs. Remove photos explicitly if they must stop being served. Cached copies cannot be recalled. Uploads use new immutable keys.</p><form onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);data.set("restaurant_id",restaurantId);data.set("operation",((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement)?.value??"review");start(async()=>{try{onResult(await mutateRestaurantPhotos({},data));}catch{onResult({error:"Photo storage is unavailable. Try again."});}});}}><fieldset disabled={pending}><legend className="sr-only">Unused photo review</legend><button className="text-link" name="operation" value="review">Review unused files</button><label className="admin-checkbox"><input type="checkbox" name="confirm" value="yes"/> Confirm cleanup of unused files older than 24 hours for this restaurant.</label><button className="text-link" name="operation" value="cleanup">Clean up old unused files</button></fieldset></form></details>
  </section>;
}
