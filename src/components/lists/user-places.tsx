"use client";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, Coffee, LockKeyhole, MapPin, Pencil, Plus, Trash2, Utensils } from "lucide-react";
import { mutateUserPlace } from "@/app/lists/places/actions";
import { googleMapsUrl, type UserPlace } from "@/lib/user-places";
import { ListDialog } from "./list-dialog";
import { MutationFeedback } from "./list-forms";
import type { ListState } from "@/lib/lists";

function PlaceForm({ place, deleting = false, close, setBusy, onSaved }: { place?: UserPlace; deleting?: boolean; close: () => void; setBusy: (busy: boolean) => void; onSaved: (message: string) => void }) {
  const [state, action, pending] = useActionState<ListState, FormData>(async (previous, form) => {
    const result = await mutateUserPlace(previous, form);
    // Deletion can unmount this card in the returned server tree. Notify the
    // surviving overview here rather than relying on an effect in this form.
    if (result.success) { onSaved(result.success); close(); }
    return result;
  }, {});
  const prefix = useId();
  useEffect(() => { setBusy(pending); }, [pending, setBusy]);
  // Controlled fields retain the user's input after server validation errors.
  const [values, setValues] = useState({ name: place?.name ?? "", category: place?.category ?? "restaurant", area: place?.area ?? "", address: place?.address ?? "", google_maps_url: place?.google_maps_url ?? "", notes: place?.notes ?? "" });
  const change = (key: keyof typeof values, value: string) => setValues(previous => ({ ...previous, [key]: value }));
  return <form className="list-form" action={action} aria-label={deleting ? "Delete private place" : place ? "Edit private place" : "Create private place"} aria-busy={pending}>
    <input type="hidden" name="operation" value={deleting ? "delete" : place ? "edit" : "create"} />{place && <input type="hidden" name="place_id" value={place.id} />}
    {deleting ? <><input type="hidden" name="confirm" value="yes" /><p className="list-dialog-intro">Delete “{place?.name}”? This removes the place from every private list, including any list-specific notes. This cannot be undone. Your official restaurant entries stay intact.</p></> : <fieldset disabled={pending}>
      <label htmlFor={`${prefix}-name`}>Name</label><input id={`${prefix}-name`} name="name" required maxLength={120} value={values.name} onChange={e => change("name", e.target.value)} autoFocus data-dialog-autofocus />
      <label htmlFor={`${prefix}-category`}>Category</label><select id={`${prefix}-category`} name="category" value={values.category} onChange={e => change("category", e.target.value)}><option value="restaurant">Restaurant</option><option value="cafe">Cafe</option></select>
      <label htmlFor={`${prefix}-area`}>Area / neighborhood <span>(optional)</span></label><input id={`${prefix}-area`} name="area" maxLength={160} value={values.area} onChange={e => change("area", e.target.value)} />
      <label htmlFor={`${prefix}-address`}>Address <span>(optional)</span></label><textarea id={`${prefix}-address`} name="address" rows={2} maxLength={1000} value={values.address} onChange={e => change("address", e.target.value)} />
      <label htmlFor={`${prefix}-maps`}>Google Maps URL <span>(optional)</span></label><input id={`${prefix}-maps`} name="google_maps_url" type="url" maxLength={2048} value={values.google_maps_url} onChange={e => change("google_maps_url", e.target.value)} aria-describedby={`${prefix}-maps-help`} /><small id={`${prefix}-maps-help`} className="muted">HTTPS Google Maps or Google Maps share link.</small>
      <label htmlFor={`${prefix}-notes`}>Personal notes <span>(optional · only you)</span></label><textarea id={`${prefix}-notes`} name="notes" rows={3} maxLength={5000} value={values.notes} onChange={e => change("notes", e.target.value)} />
    </fieldset>}
    <MutationFeedback state={state} /><div className="list-form-actions"><button type={deleting ? "button" : "submit"} className={deleting ? "button button-outline" : "button button-dark"} disabled={pending} onClick={deleting ? close : undefined} autoFocus={deleting} data-dialog-autofocus={deleting || undefined}>{deleting ? "Keep place" : pending ? "Saving…" : place ? "Save changes" : "Create place"}</button>{deleting ? <button type="submit" className="button button-dark" disabled={pending}>{pending ? "Deleting…" : "Delete place"}</button> : <button type="button" className="button button-outline" disabled={pending} onClick={close}>Cancel</button>}</div>
  </form>;
}

function PlaceCard({ place, onSaved }: { place: UserPlace; onSaved: (message: string) => void }) {
  const Icon = place.category === "cafe" ? Coffee : Utensils;
  let maps: string | null = null;
  try { maps = googleMapsUrl(place.google_maps_url); } catch { /* Never render an unsafe stored URL. */ }
  return <article className="saved-place-card private-place-card"><div className="saved-card-top"><span className="saved-category"><Icon size={13} />{place.category} · private</span><div className="saved-card-actions">
    <ListDialog title="Edit private place" trigger={<Pencil size={15} />} triggerClassName="icon-button" triggerLabel={`Edit ${place.name}`}>{(close, setBusy) => <PlaceForm place={place} close={close} setBusy={setBusy} onSaved={onSaved} />}</ListDialog>
    <ListDialog title="Delete private place?" trigger={<Trash2 size={15} />} triggerClassName="icon-button" triggerLabel={`Delete ${place.name}`}>{(close, setBusy) => <PlaceForm place={place} deleting close={close} setBusy={setBusy} onSaved={onSaved} />}</ListDialog>
  </div></div><h2>{place.name}</h2>{place.area && <p className="private-place-location"><MapPin size={13} />{place.area}</p>}{place.address && <p className="private-place-text">{place.address}</p>}{maps && <a href={maps} target="_blank" rel="noopener noreferrer" className="text-link private-place-map" aria-label={`Google Maps for ${place.name} (opens in new tab)`}>Google Maps ↗</a>}{place.notes && <p className="private-place-text"><span className="sr-only">Personal notes: </span>{place.notes}</p>}</article>;
}
export function UserPlaces({ places }: { places: UserPlace[] }) {
  const [message, setMessage] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!message.startsWith("Private place deleted")) return;
    // Native dialog dismissal restores focus first; the deleted trigger no longer
    // exists, so move focus to the surviving success message on the next frame.
    const frame = requestAnimationFrame(() => feedback.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [message]);
  return <div className="container lists-page"><Link href="/lists" className="back-link"><ArrowLeft size={14} />My Lists</Link><header className="lists-heading"><p className="eyebrow"><LockKeyhole size={12} />ONLY YOU</p><div className="private-places-heading"><h1>My Places<span>.</span></h1><ListDialog title="New private place" trigger={<><Plus size={16} />New place</>} triggerClassName="button button-dark">{(close, setBusy) => <PlaceForm close={close} setBusy={setBusy} onSaved={setMessage} />}</ListDialog></div><p>Your own restaurants and cafes. Private to your account, separate from the public catalogue.</p></header><p className="list-feedback" role="status" ref={feedback} tabIndex={-1}>{message}</p>
    {places.length ? <section className="saved-grid" aria-label="Your private places">{places.map(place => <PlaceCard key={place.id} place={place} onSaved={setMessage} />)}</section> : <div className="list-empty"><MapPin size={26} /><h2>No private places yet</h2><p>Create a place above, then add it to any of your lists.</p></div>}
    <p className="picker-hint">Manage memberships using the searchable picker in each private list. Personal place notes stay here; each list can have its own note.</p>
  </div>;
}
