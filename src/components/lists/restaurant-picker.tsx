"use client";
import { useDeferredValue, useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Search } from "lucide-react";
import { useListMutation } from "./use-list-mutation";
import { MutationFeedback } from "./list-forms";
import type { ListRestaurant } from "@/lib/lists";

export function RestaurantPicker({ listId, restaurants, savedIds, unavailable = false }: { listId: string; restaurants: ListRestaurant[]; savedIds: string[]; unavailable?: boolean }) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const listbox = useRef<HTMLUListElement>(null);
  const prefix = useId();
  const { pending, feedback, run } = useListMutation();
  const [refreshing, startRefresh] = useTransition();
  const router = useRouter();
  const saved = new Set(savedIds);
  const matches = restaurants.filter(row => !saved.has(row.id) && row.name.toLocaleLowerCase().includes(deferred.trim().toLocaleLowerCase()));
  const searching = query !== deferred;
  useEffect(() => { if ((notice || feedback.error) && !pending) input.current?.focus(); }, [notice, pending, feedback.error]);
  const activeIndex = Math.min(active, Math.max(0, matches.length - 1));
  function choose(row: ListRestaurant) {
    if (pending || searching) return;
    const form = new FormData();
    form.set("operation", "add"); form.set("list_id", listId); form.set("restaurant_id", row.id);
    run(form, () => { setQuery(""); setOpen(false); setNotice(`${row.name} added to your list.`); });
  }
  function move(next: number) {
    setActive(next);
    listbox.current?.children[next]?.scrollIntoView({ block: "nearest" });
  }
  return <div className="restaurant-picker" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={`${prefix}-search`} className="sr-only">Add a restaurant</label><div className="picker-input-wrap"><Search size={18} aria-hidden="true" /><input id={`${prefix}-search`} ref={input} role="combobox" aria-autocomplete="list" aria-expanded={open && !unavailable} aria-controls={open && !unavailable ? `${prefix}-results` : undefined} aria-activedescendant={open && matches.length && !searching && !unavailable ? `${prefix}-option-${activeIndex}` : undefined} aria-describedby={`${prefix}-hint`} autoComplete="off" placeholder="Add a restaurant — search by name" value={query} disabled={pending || unavailable} onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); setNotice(""); }} onFocus={() => { if (!notice) setOpen(true); }} onClick={() => setOpen(true)} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault(); setOpen(true);
        if (matches.length) move(open ? (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length : 0);
      }
      if (event.key === "Enter") { event.preventDefault(); if (open && matches[activeIndex]) choose(matches[activeIndex]); else setOpen(true); }
    }} />{pending ? <LoaderCircle size={17} className="list-spinner" aria-label="Adding restaurant" /> : <Plus size={18} aria-hidden="true" />}</div>
    <p className="picker-hint" id={`${prefix}-hint`}>{pending ? "Adding to your private list…" : "From the public catalogue. Places already in this list are hidden."}</p>
    {unavailable ? <p className="list-message" role="alert">Restaurant search couldn’t load. <button type="button" className="text-button" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}>{refreshing ? "Loading…" : "Try again"}</button></p> : open && <div className="picker-panel"><ul id={`${prefix}-results`} role="listbox" aria-label="Restaurants to add" ref={listbox} aria-busy={searching || pending}>
      {matches.map((row, index) => <li id={`${prefix}-option-${index}`} key={row.id} role="option" aria-selected={index === activeIndex} aria-disabled={pending || searching} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(row)}><span><strong>{row.name}</strong><small>{row.category === "cafe" ? "Cafe" : "Restaurant"} · Lahore</small></span><Plus size={16} aria-hidden="true" /></li>)}
    </ul>{searching ? <p className="picker-status" role="status">Searching…</p> : matches.length === 0 ? <p className="picker-status" role="status">{query.trim() ? "No new restaurants match that name." : "You’ve saved all available restaurants in this list."}</p> : <p className="picker-status" role="status">{matches.length} {matches.length === 1 ? "place" : "places"} · ↑ ↓ to browse, Enter to add</p>}<MutationFeedback state={{ error: feedback.error }} /></div>}
    <MutationFeedback state={{ error: !open ? feedback.error : undefined, success: notice }} />
  </div>;
}
