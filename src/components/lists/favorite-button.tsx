"use client";
import Link from "next/link";
import { Heart, LoaderCircle, RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { useLikedPlaces } from "./liked-places-provider";
import { ListDialog } from "./list-dialog";

export function FavoriteButton({ restaurantId, name, large = false }: { restaurantId: string; name: string; large?: boolean }) {
  const { restaurantIds, userId, unavailable, pendingId, setLiked, refreshLikes } = useLikedPlaces();
  const [refreshing, startRefresh] = useTransition();
  const active = !!userId && restaurantIds.includes(restaurantId);
  const className = large ? "button favorite-large" : "favorite-button";
  const icon = <Heart size={large ? 19 : 17} fill={active ? "currentColor" : "none"} aria-hidden="true" />;
  if (unavailable) return <button className={className} type="button" aria-label={`Retry Liked Places for ${name}`} disabled={refreshing} onClick={() => startRefresh(refreshLikes)}><RotateCcw size={17} aria-hidden="true" />{large && "Retry likes"}</button>;
  if (!userId) return <ListDialog title="Sign in to like" trigger={icon} triggerClassName={className} triggerLabel={`Like ${name}`}>
    {close => <><p className="list-dialog-intro">Save restaurants to your private Liked Places collection.</p><div className="list-form-actions"><Link className="button button-dark" href="/login">Log in</Link><button className="button button-outline" type="button" onClick={close}>Cancel</button></div></>}
  </ListDialog>;
  const pending = pendingId === restaurantId;
  return <button type="button" className={className} aria-label={pending ? `Saving like for ${name}` : `${active ? "Unlike" : "Like"} ${name}`} aria-pressed={active} aria-busy={pending} disabled={!!pendingId} onClick={() => { void setLiked(restaurantId, !active); }} title={active ? "Remove from Liked Places" : "Save to Liked Places"}>
    {pending ? <LoaderCircle size={17} className="list-spinner" aria-hidden="true" /> : icon}{large && (pending ? "Saving…" : active ? "Liked" : "Like")}
  </button>;
}
