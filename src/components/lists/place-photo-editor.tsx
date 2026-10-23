"use client";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { PlaceCover } from "./place-cover";
import { checkPhotoType, PHOTO_SOURCE_BYTES } from "@/lib/place-photo";
import { reviewPlacePhotos } from "@/app/lists/places/actions";
import { MutationFeedback } from "./list-forms";
import type { UserPlace } from "@/lib/user-places";
import type { ListState } from "@/lib/lists";

export function PlacePhotoEditor({place,disabled,onSelect}:{place?:UserPlace;disabled:boolean;onSelect:(file:File|null)=>void}) {
  const id=useId(),input=useRef<HTMLInputElement>(null);
  const [preview,setPreview]=useState("");
  const [error,setError]=useState("");
  const [confirming,setConfirming]=useState(false),[removing,setRemoving]=useState(false);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  const clear=()=>{onSelect(null);setPreview("");if(input.current)input.current.value="";};
  return <div className="place-photo-editor"><label htmlFor={id}>Cover photo <span>(optional · only you)</span></label>
    <PlaceCover id={place?.id??"new"} objectId={removing?null:place?.photo_object_id} name={place?.name??"your place"} preview={preview||undefined} />
    <input id={id} ref={input} name="photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} aria-describedby={`${id}-help`} onChange={event=>{
      const file=event.target.files?.[0];setError("");setConfirming(false);
      if(!file){clear();return;}
      try{checkPhotoType(file.type);if(file.size>PHOTO_SOURCE_BYTES)throw Error("Choose a source photo under 10MB.");onSelect(file);setPreview(URL.createObjectURL(file));setRemoving(false);}
      catch(error){clear();setError(error instanceof Error?error.message:"Choose another photo.");}
    }} />
    <small id={`${id}-help`}>JPEG, PNG or WebP up to 10MB. Resized to 1600px and under 1MB before storage. HEIC/HEIF is not supported.</small>
    {preview&&<button type="button" className="text-button" disabled={disabled} onClick={clear}>Clear selection</button>}
    {place?.photo_object_id&&!removing&&!confirming&&<button type="button" className="text-button" disabled={disabled} onClick={()=>setConfirming(true)}>Remove current photo</button>}
    {confirming&&<div className="photo-removal-confirm"><p>Remove this cover photo when you save? The place and its notes will stay.</p><button type="button" className="text-button" disabled={disabled} onClick={()=>{clear();setRemoving(true);setConfirming(false);}}>Confirm photo removal</button><button type="button" className="text-button" disabled={disabled} onClick={()=>setConfirming(false)}>Keep photo</button></div>}
    {removing&&<><input type="hidden" name="remove_photo" value="yes"/><input type="hidden" name="confirm_remove_photo" value="yes"/><p role="status">Cover photo will be removed when you save.</p><button type="button" className="text-button" disabled={disabled} onClick={()=>setRemoving(false)}>Keep photo instead</button></>}
    {error&&<p role="alert" className="list-message">{error}</p>}
  </div>;
}
export function PlacePhotoStorage() {
  const [open,setOpen]=useState(false);
  const [state,action,pending]=useActionState<ListState,FormData>(reviewPlacePhotos,{});
  const id=useId();
  return <details className="photo-storage" onToggle={event=>setOpen(event.currentTarget.open)}><summary>Photo storage</summary>{open&&<><p>Review only your unused uploads. Recent uploads and referenced photos stay protected.</p><form action={action} aria-busy={pending}><fieldset disabled={pending}><button className="button button-outline" name="cleanup" value="no">{pending?"Reviewing…":"Review unused photos"}</button><label htmlFor={id}><input id={id} type="checkbox" name="confirm" value="yes"/> I confirm cleanup of my unused photos older than 24 hours.</label><button className="text-button" name="cleanup" value="yes">Clean up old unused photos</button></fieldset><MutationFeedback state={state}/></form></>}</details>;
}
