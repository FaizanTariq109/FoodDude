"use client";
import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ListDialog } from "./list-dialog";
import { useListMutation } from "./use-list-mutation";
import type { ListState, UserList } from "@/lib/lists";

export function MutationFeedback({ state }: { state: ListState }) {
  return <>{state.error && <p className="list-message" role="alert">{state.error}</p>}{state.success && <p className="list-feedback" role="status">{state.success}</p>}</>;
}

export function ListFieldsForm({ list, onCancel, onSaved, setBusy }: { list?: UserList; onCancel: () => void; onSaved?: () => void; setBusy?: (busy: boolean) => void }) {
  const { pending, feedback, run } = useListMutation(setBusy);
  const prefix = useId();
  const [name, setName] = useState(list?.name ?? "");
  const [description, setDescription] = useState(list?.description ?? "");
  return <form className="list-form" aria-label={list ? "Edit list" : "Create list"} aria-busy={pending} action={form => run(form, onSaved)}>
    <input type="hidden" name="operation" value={list ? "edit" : "create"} />
    {list && <input type="hidden" name="list_id" value={list.id} />}
    <fieldset disabled={pending}><label htmlFor={`${prefix}-title`}>Title</label><input id={`${prefix}-title`} name="name" required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Date Nights, Want to Try…" autoFocus data-dialog-autofocus />
      <label htmlFor={`${prefix}-description`}>Description <span>(optional)</span></label><textarea id={`${prefix}-description`} name="description" maxLength={1000} rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder="What’s this list for?" />
      <div className="list-form-actions"><button type="submit" className="button button-dark">{pending ? "Saving…" : list ? "Save changes" : "Create List"}</button><button type="button" className="button button-outline" onClick={onCancel}>Cancel</button></div>
    </fieldset><MutationFeedback state={feedback} />
  </form>;
}

export function NewListTile() {
  return <ListDialog title="Create List" triggerClassName="collection-card new-list-tile" trigger={<><span className="new-list-plus"><Plus size={27} strokeWidth={1.3} /></span><span className="new-list-title">New List</span><span className="new-list-copy">Save restaurants together.</span></>} triggerLabel="New List">
    {(close, setBusy) => <><p className="list-dialog-intro">Choose a title and an optional description.</p><ListFieldsForm onCancel={close} setBusy={setBusy} /></>}
  </ListDialog>;
}

function ConfirmForm({ listId, entryId, onCancel, setBusy }: { listId: string; entryId?: string; onCancel: () => void; setBusy: (busy: boolean) => void }) {
  const { pending, feedback, run } = useListMutation(setBusy);
  return <form className="list-form" action={form => run(form, onCancel)} aria-busy={pending}>
    <input type="hidden" name="operation" value={entryId ? "remove" : "delete"} /><input type="hidden" name="list_id" value={listId} /><input type="hidden" name="confirm" value="yes" />{entryId && <input type="hidden" name="entry_id" value={entryId} />}
    <div className="list-form-actions"><button type="button" className="button button-outline" disabled={pending} onClick={onCancel} autoFocus data-dialog-autofocus>Keep it</button><button type="submit" className="button button-dark" disabled={pending}>{pending ? "Removing…" : entryId ? "Remove restaurant" : "Delete list"}</button></div><MutationFeedback state={feedback} />
  </form>;
}

export function DeleteList({ list }: { list: UserList }) {
  return <ListDialog title="Delete this list?" trigger={<><Trash2 size={14} />Delete list</>} triggerClassName="list-delete-trigger text-button" triggerLabel={`Delete ${list.name}`}>
    {(close, setBusy) => <><p className="list-dialog-intro">“{list.name}” and its saved entries and notes will be deleted. This cannot be undone.</p><ConfirmForm listId={list.id} onCancel={close} setBusy={setBusy} /></>}
  </ListDialog>;
}

export function RemoveEntry({ listId, entryId, name, disabled = false }: { listId: string; entryId: string; name: string; disabled?: boolean }) {
  return <ListDialog title="Remove this restaurant?" trigger={<Trash2 size={16} />} triggerClassName="icon-button" triggerLabel={`Remove ${name} from this list`} disabled={disabled}>
    {(close, setBusy) => <><p className="list-dialog-intro">Remove “{name}” and its private note from this list? Your other lists stay as they are.</p><ConfirmForm listId={listId} entryId={entryId} onCancel={close} setBusy={setBusy} /></>}
  </ListDialog>;
}
