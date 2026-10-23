"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { BookmarkPlus, Check, LockKeyhole } from "lucide-react";
import { mutateList } from "@/app/lists/actions";
import { ListDialog } from "./list-dialog";
import type { UserList } from "@/lib/lists";

function DestinationForm({ lists, savedIds, restaurantId, close, setBusy }: { lists: UserList[]; savedIds: string[]; restaurantId: string; close: () => void; setBusy: (busy: boolean) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState(savedIds);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const doneButton = useRef<HTMLButtonElement>(null);
  const firstAvailable = lists.find(list => !saved.includes(list.id))?.id;
  useEffect(() => { if (message && !pending) doneButton.current?.focus(); }, [message, pending]);
  function submit() {
    if (inFlight.current || selected.length === 0) return;
    inFlight.current = true; setBusy(true); setMessage(""); setError("");
    startTransition(async () => {
      const completed: string[] = [];
      let failed = false;
      try {
        for (const id of selected) {
          const form = new FormData(); form.set("operation", "add"); form.set("list_id", id); form.set("restaurant_id", restaurantId);
          const result = await mutateList({}, form);
          if (result.success || result.duplicate) completed.push(id);
          else failed = true;
        }
      } catch { failed = true; }
      finally {
        setSaved(previous => [...new Set([...previous, ...completed])]);
        setSelected(previous => previous.filter(id => !completed.includes(id)));
        if (completed.length) setMessage(`Saved in ${completed.length} ${completed.length === 1 ? "list" : "lists"}.`);
        if (failed) setError("We couldn’t save to every selected list. Please try again.");
        inFlight.current = false; setBusy(false);
      }
    });
  }
  return <form onSubmit={event => { event.preventDefault(); submit(); }} aria-busy={pending}>
    <p className="list-dialog-intro">Choose custom lists. Use the heart for Liked Places.</p>
    <fieldset className="save-destinations" disabled={pending}><legend className="sr-only">Destination lists</legend>{lists.map(list => {
      const alreadySaved = saved.includes(list.id);
      return <label key={list.id} className={`save-destination${alreadySaved ? " already-saved" : ""}`}><input type="checkbox" name="list_id" value={list.id} checked={alreadySaved || selected.includes(list.id)} disabled={alreadySaved} data-dialog-autofocus={list.id === firstAvailable || undefined} onChange={event => setSelected(previous => event.target.checked ? [...previous, list.id] : previous.filter(id => id !== list.id))} /><span><strong>{list.name}</strong>{alreadySaved ? <small><Check size={12} />Already in this list</small> : list.description && <small>{list.description}</small>}</span><LockKeyhole size={13} /></label>;
    })}</fieldset>
    {message && <p className="list-feedback" role="status">{message}</p>}{error && <p className="list-message" role="alert">{error}</p>}
    <div className="list-form-actions"><button type="submit" className="button button-dark" disabled={pending || selected.length === 0}>{pending ? "Saving…" : `Save${selected.length ? ` to ${selected.length} ${selected.length === 1 ? "list" : "lists"}` : " to List"}`}</button><button ref={doneButton} type="button" className="button button-outline" disabled={pending} onClick={close}>{message ? "Done" : "Cancel"}</button></div>
    <Link href="/lists" className={`save-manage-link text-link${pending ? " is-disabled" : ""}`} aria-disabled={pending} tabIndex={pending ? -1 : undefined} onClick={event => { if (pending) event.preventDefault(); }}>Create or manage lists ↗</Link>
  </form>;
}

export function SaveToLists({ restaurantId, lists = [], savedIds = [], authenticated, unavailable = false }: { restaurantId: string; lists?: UserList[]; savedIds?: string[]; authenticated: boolean; unavailable?: boolean }) {
  return <ListDialog title="Save to List" triggerClassName="button button-outline save-to-list-trigger" trigger={<><BookmarkPlus size={17} />Save to List</>}>
    {(close, setBusy) => unavailable ? <><p className="list-dialog-intro" role="alert">Your lists couldn’t be loaded. Please try again.</p><Link className="button button-dark" href="/lists">Go to My Lists</Link><button className="button button-outline" type="button" onClick={close}>Cancel</button></> : !authenticated ? <><p className="list-dialog-intro">Sign in to save restaurants to private lists.</p><div className="list-form-actions"><Link className="button button-dark" href="/login">Sign in to save</Link><button className="button button-outline" type="button" onClick={close}>Keep exploring</button></div></> : lists.filter(list => list.kind !== "liked").length ? <DestinationForm lists={lists.filter(list => list.kind !== "liked")} savedIds={savedIds} restaurantId={restaurantId} close={close} setBusy={setBusy} /> : <><p className="list-dialog-intro">Create a custom list, or use the heart to save to Liked Places.</p><div className="list-form-actions"><Link className="button button-dark" href="/lists">Create a list</Link><button className="button button-outline" type="button" onClick={close}>Cancel</button></div></>}
  </ListDialog>;
}
