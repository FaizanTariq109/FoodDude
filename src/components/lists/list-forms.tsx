"use client";
import { useActionState, useId } from "react";
import { mutateList } from "@/app/lists/actions";
import type { ListState, UserList } from "@/lib/lists";

export function ListForm({ operation, list, entryId, notes, restaurants, lists, restaurantId }: {
  operation: "create" | "edit" | "delete" | "add" | "notes" | "remove";
  list?: UserList; entryId?: string; notes?: string | null;
  restaurants?: { id: string; name: string }[]; lists?: UserList[]; restaurantId?: string;
}) {
  const [state, action, pending] = useActionState<ListState, FormData>(mutateList, {});
  const prefix = useId();
  const editing = operation === "create" || operation === "edit";
  const label = { create: "Create list", edit: "Save list", delete: "Delete list", add: "Add to list", notes: "Save private note", remove: "Remove restaurant" }[operation];
  return <form action={action} className="list-form" aria-label={label} aria-busy={pending}>
    <input type="hidden" name="operation" value={operation} />
    {list && <input type="hidden" name="list_id" value={list.id} />}
    {entryId && <input type="hidden" name="entry_id" value={entryId} />}
    <fieldset disabled={pending}>
      {editing && <><label htmlFor={`${prefix}-name`}>List name</label><input id={`${prefix}-name`} name="name" required maxLength={80} defaultValue={list?.name} placeholder="Date Nights, Want to Try…" />
        <label htmlFor={`${prefix}-description`}>Description <span>(optional)</span></label><textarea id={`${prefix}-description`} name="description" maxLength={1000} defaultValue={list?.description ?? ""} rows={3} /></>}
      {operation === "add" && <>
        {lists && <><label htmlFor={`${prefix}-list`}>Choose your list</label><select id={`${prefix}-list`} name="list_id" required defaultValue=""><option value="" disabled>Select a list</option>{lists.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></>}
        {restaurantId ? <input type="hidden" name="restaurant_id" value={restaurantId} /> : <><label htmlFor={`${prefix}-restaurant`}>Public restaurant</label><select id={`${prefix}-restaurant`} name="restaurant_id" required defaultValue=""><option value="" disabled>Select a restaurant</option>{restaurants?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></>}
      </>}
      {(operation === "notes" || operation === "add") && <><label htmlFor={`${prefix}-notes`}>Private note <span>(optional · only you)</span></label><textarea id={`${prefix}-notes`} name="notes" maxLength={5000} rows={3} defaultValue={notes ?? ""} /></>}
      {operation === "delete" && <label className="list-confirm"><input type="checkbox" name="confirm" value="yes" required />Delete this list and all its saved entries and notes. This cannot be undone.</label>}
      <button type="submit" className={`button ${operation === "delete" || operation === "remove" ? "button-outline" : "button-dark"}`}>{pending ? "Saving…" : label}</button>
    </fieldset>
    {state.error && <p role="alert" className="list-message">{state.error}</p>}
    {state.success && <p role="status" className="list-message">{state.success}</p>}
  </form>;
}
