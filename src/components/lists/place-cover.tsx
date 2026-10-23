"use client";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { coverSource } from "@/lib/place-photo";

export function PlaceCover({ id, objectId, name, preview }: { id: string; objectId?: string | null; name: string; preview?: string }) {
  const src=preview??coverSource(id,objectId);
  const [failed,setFailed]=useState<string|null>(null);
  const [loaded,setLoaded]=useState<string|null>(null);
  return <div className={`private-cover${src && loaded===src ? " is-loaded":""}`}>
    <div className="private-cover-placeholder" aria-hidden={!!src&&loaded===src&&failed!==src}><ImageIcon size={25} strokeWidth={1.2} aria-hidden="true" /><span>{src && failed===src?"Photo unavailable":src?"Loading private photo…":"Your place, your perspective"}</span>{src&&failed===src&&<button type="button" className="text-button" onClick={()=>setFailed(null)}>Retry photo</button>}</div>
    {src&&failed!==src&&<Image key={src} src={src} alt={`Cover photo for ${name}`} width={1600} height={1000} unoptimized onError={()=>setFailed(src)} onLoad={()=>setLoaded(src)} />}
  </div>;
}
