"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Bookmark, Coffee, Heart, LockKeyhole, Pencil, Quote, Utensils } from "lucide-react";
import { DeleteList, ListFieldsForm, MutationFeedback, RemoveEntry } from "./list-forms";
import { useListMutation } from "./use-list-mutation";
import { RestaurantPicker } from "./restaurant-picker";
import type { ListRestaurant, SavedEntry, UserList } from "@/lib/lists";
import { placeKey } from "@/lib/lists";
import { PlaceCover } from "./place-cover";

function NoteEditor({ entry, listId, onClose, setBusy }: { entry: SavedEntry; listId: string; onClose: () => void; setBusy: (busy: boolean) => void }) {
  const [notes, setNotes] = useState(entry.notes ?? "");
  const { pending, feedback, run } = useListMutation(setBusy);
  const id = useId();
  return <form className="list-form note-editor" action={form => run(form, onClose)} aria-label="Edit private note" aria-busy={pending}>
    <input type="hidden" name="operation" value="notes" /><input type="hidden" name="list_id" value={listId} /><input type="hidden" name="entry_id" value={entry.id} />
    <fieldset disabled={pending}><label htmlFor={id}>Private note <span>· only you</span></label><textarea id={id} name="notes" rows={3} maxLength={5000} value={notes} onChange={event => setNotes(event.target.value)} autoFocus placeholder="A favourite dish, a table to book…" /><div className="list-form-actions"><button type="submit" className="button button-dark">{pending ? "Saving…" : "Save note"}</button><button type="button" className="button button-outline" onClick={onClose}>Cancel</button></div></fieldset><MutationFeedback state={feedback} />
  </form>;
}

function SavedRestaurantCard({ entry, listId, restaurant, catalogueUnavailable }: { entry: SavedEntry; listId: string; restaurant?: ListRestaurant; catalogueUnavailable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const pencil = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (editing) wasEditing.current = true;
    else if (!savingNote && wasEditing.current) { pencil.current?.focus(); wasEditing.current = false; }
  }, [editing, savingNote]);
  const name = restaurant?.name ?? "Restaurant unavailable";
  const close = () => setEditing(false);
  const Icon = restaurant?.category === "cafe" ? Coffee : Utensils;
  return <article className={`saved-place-card${editing ? " is-editing" : ""}`}>{restaurant?.private&&<PlaceCover id={restaurant.id} objectId={restaurant.photo_object_id} name={name}/>}<div className="saved-card-top"><span className="saved-category"><Icon size={13} />{restaurant?.category ?? "Saved place"}</span><div className="saved-card-actions"><button type="button" className="icon-button" ref={pencil} aria-label={`Edit private note for ${name}`} title="Edit private note" aria-expanded={editing} disabled={savingNote} onClick={() => setEditing(value => !value)}><Pencil size={15} /></button><RemoveEntry listId={listId} entryId={entry.id} name={name} disabled={savingNote} /></div></div>
    <h2>{restaurant && !restaurant.private ? <Link href={`/places/${restaurant.slug}`}>{name}<ArrowUpRight size={17} /></Link> : name}</h2>
    {restaurant?.private && <p className="private-place-location"><LockKeyhole size={12} />Private place{restaurant.area ? ` · ${restaurant.area}` : ""}</p>}
    {!restaurant && <p className="saved-unavailable">{catalogueUnavailable ? "Restaurant details couldn’t be loaded. Your saved entry and note are safe." : "No longer publicly available. Your saved entry and note are kept."}</p>}
    {editing ? <NoteEditor entry={entry} listId={listId} onClose={close} setBusy={setSavingNote} /> : entry.notes ? <p className="saved-note"><Quote size={13} aria-hidden="true" /><span>{entry.notes}</span></p> : <p className="saved-note-empty">No private note yet.</p>}
  </article>;
}

export function ListDetail({ list, entries, restaurants, catalogueUnavailable = false }: { list: UserList; entries: SavedEntry[]; restaurants: ListRestaurant[]; catalogueUnavailable?: boolean }) {
  const [editing, setEditing] = useState(false);
  const titlePencil = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (!editing && wasEditing.current) titlePencil.current?.focus();
    wasEditing.current = editing;
  }, [editing]);
  const special = list.kind === "liked";
  const byId = new Map(restaurants.map(row => [placeKey(row), row]));
  const reference = (entry: SavedEntry) => entry.user_place_id ? `private:${entry.user_place_id}` : entry.restaurant_id!;
  const saved = entries.map(reference);
  const close = () => { setEditing(false); titlePencil.current?.focus(); };
  return <div className="container lists-page list-detail-page"><Link href="/lists" className="back-link"><ArrowLeft size={14} />My Lists</Link>
    <header className="lists-heading"><p className="eyebrow"><LockKeyhole size={12} />PRIVATE COLLECTION</p>{editing && !special ? <div className="inline-list-editor"><ListFieldsForm list={list} onCancel={close} onSaved={close} /></div> : <><div className="list-title-row"><h1>{list.name}<span>.</span></h1>{!special && <button ref={titlePencil} className="icon-button" type="button" aria-label="Edit list title and description" title="Edit list" onClick={() => setEditing(true)}><Pencil size={18} /></button>}</div>{list.description && <p className="list-description">{list.description}</p>}</>}
      <div className="list-heading-meta"><span><Bookmark size={13} />{entries.length} {entries.length === 1 ? "restaurant" : "restaurants"}</span><span>{special ? <><Heart size={12} fill="currentColor" />Default favorites · only you</> : "Only you can see this list"}</span></div>
    </header>
    <Link href="/lists/places" className="text-link my-places-action">Manage My Places<ArrowUpRight size={14} /></Link>
    <RestaurantPicker listId={list.id} restaurants={restaurants} savedIds={saved} unavailable={catalogueUnavailable} />
    <section className="saved-grid" aria-label="Saved restaurants">{entries.map(entry => <SavedRestaurantCard key={entry.id} entry={entry} listId={list.id} restaurant={byId.get(reference(entry))} catalogueUnavailable={catalogueUnavailable} />)}</section>
    {entries.length === 0 && <div className="list-empty"><Bookmark size={26} strokeWidth={1.2} /><h2>No saved restaurants</h2><p>Search above to add a restaurant.</p><Link className="text-link" href="/discover">Explore Lahore<ArrowUpRight size={14} /></Link></div>}
    <footer className="list-detail-footer"><span><LockKeyhole size={12} />Private list · only you</span>{!special && <DeleteList list={list} />}</footer>
  </div>;
}
