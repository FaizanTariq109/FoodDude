"use client";
import { useActionState, useState } from "react";
import { saveBranch } from "@/app/admin/restaurants/branch-actions";
import type { AdminBranch } from "@/lib/branches";

export function BranchForm({ restaurantId, row, statusOnly = false }: { restaurantId: string; row?: AdminBranch; statusOnly?: boolean }) {
  const [state, action, pending] = useActionState(saveBranch, {});
  // Controlled fields retain entered values when an action returns a validation error.
  const [fields, setFields] = useState(() => ({ name: row?.name ?? "", area: row?.area ?? "",
    address: row?.address ?? "", phone: row?.phone ?? "", google_maps_url: row?.google_maps_url ?? "",
    latitude: row?.latitude?.toString() ?? "", longitude: row?.longitude?.toString() ?? "", is_active: row?.is_active ?? true }));
  const input = (key: Exclude<keyof typeof fields, "is_active">) => ({ value: fields[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFields(current => ({ ...current, [key]: event.target.value })) });
  const location = row?.name || row?.area || row?.address || "this branch";
  if (state.savedId) return <div className="admin-panel" role="status"><p>Branch saved.</p><a className="text-link" href={`/admin/restaurants/${restaurantId}/edit#branches`}>View latest branches</a></div>;
  return <form action={action} className="admin-editor">
    <input type="hidden" name="restaurant_id" value={restaurantId} />
    {row && <><input type="hidden" name="id" value={row.id} /><input type="hidden" name="updated_at" value={row.updated_at} /></>}
    {statusOnly && <><input type="hidden" name="operation" value="status" /><input type="hidden" name="is_active" value={row?.is_active ? "" : "on"} /></>}
    <fieldset disabled={pending}><legend>{statusOnly ? `Change status: ${location}` : row ? `Edit branch: ${location}` : "Add a branch"}</legend>
      {!statusOnly && <>
        <p>Use verified information only. Leave unknown fields blank. Enter a name, area or address to identify the branch. Check existing active and inactive locations before adding one.</p>
        <label>Branch name (optional)<input name="name" maxLength={200} {...input("name")} /></label>
        <label>Area<input name="area" maxLength={200} {...input("area")} /></label>
        <label>Full address<textarea name="address" maxLength={1000} rows={3} {...input("address")} /></label>
        <label>Contact phone<input name="phone" type="tel" maxLength={80} {...input("phone")} /></label>
        <label>Google Maps URL<input name="google_maps_url" type="url" maxLength={2048} {...input("google_maps_url")} placeholder="https://www.google.com/maps/…" /><span>HTTPS Google Maps links only, including maps.app.goo.gl short links.</span></label>
        <div className="admin-coordinates"><label>Latitude (optional)<input name="latitude" type="number" min={-90} max={90} step="any" {...input("latitude")} /></label><label>Longitude (optional)<input name="longitude" type="number" min={-180} max={180} step="any" {...input("longitude")} /></label></div>
        <p>Enter both coordinates or leave both blank. Coordinates are stored to six decimal places.</p>
        <label className="admin-checkbox"><input type="checkbox" name="is_active" checked={fields.is_active} onChange={event => setFields(current => ({ ...current, is_active: event.target.checked }))} />Active — visible publicly when the restaurant is active</label>
      </>}
      {statusOnly && row?.is_active && <label className="admin-checkbox"><input type="checkbox" required />Confirm: hide this branch from public pages</label>}
      {state.error && <p role="alert">{state.error}</p>}
      <button className="button button-dark" type="submit">{pending ? "Saving…" : statusOnly ? (row?.is_active ? "Deactivate branch" : "Reactivate branch") : row ? "Save branch changes" : "Add branch"}</button>
    </fieldset>
  </form>;
}
