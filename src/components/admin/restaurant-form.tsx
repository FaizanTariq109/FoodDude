"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveRestaurant } from "@/app/admin/restaurants/actions";
import { slugFromName } from "@/lib/admin/restaurant-input";
import type { AdminRestaurant } from "@/lib/admin/restaurants";

export function RestaurantForm({ row }: { row?: AdminRestaurant }) {
  const [state, action, pending] = useActionState(saveRestaurant, {});
  const [slug, setSlug] = useState(row?.slug ?? "");
  const [customSlug, setCustomSlug] = useState(!!row);
  const [values, setValues] = useState({ name: row?.name ?? "", category: row?.category ?? "restaurant", short_description: row?.short_description ?? "", price_level: String(row?.price_level ?? ""), website_url: row?.website_url ?? "", instagram_url: row?.instagram_url ?? "", is_active: row?.is_active ?? true });
  if (state.savedId) return <section className="admin-panel" role="status"><h2>Restaurant {row ? "saved" : "created"}.</h2><p>Your changes are saved.</p><Link className="button button-dark" href="/admin/restaurants">Back to restaurants</Link><a className="text-link" href={`/admin/restaurants/${state.savedId}/edit`}>Edit saved restaurant</a></section>;
  return <form className="admin-editor" action={action}>
    {row && <><input type="hidden" name="id" value={row.id} /><input type="hidden" name="updated_at" value={row.updated_at} /></>}
    <fieldset disabled={pending}>
      <legend className="sr-only">Official restaurant fields</legend>
      <label>Name <input name="name" required maxLength={200} value={values.name} onChange={event => { setValues({ ...values, name: event.target.value }); if (!customSlug) setSlug(slugFromName(event.target.value)); }} /></label>
      <label>Slug <input name="slug" required maxLength={200} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={event => { setCustomSlug(true); setSlug(event.target.value); }} aria-describedby="slug-help" /></label>
      <p id="slug-help">Used in public URLs. Lowercase letters, numbers and hyphens only.{row && " Changing it may break existing links."}</p>
      {row && slug !== row.slug && <label className="admin-checkbox" key={slug}><input type="checkbox" required /> I confirm the URL change; existing links may stop working.</label>}
      <label>Category <select name="category" value={values.category} onChange={event => setValues({ ...values, category: event.target.value as "restaurant" | "cafe" })}><option value="restaurant">Restaurant</option><option value="cafe">Cafe</option></select></label>
      <label>Short description (optional) <textarea name="short_description" rows={4} maxLength={2000} value={values.short_description} onChange={event => setValues({ ...values, short_description: event.target.value })} /></label>
      <label>Price level (optional) <select name="price_level" value={values.price_level} onChange={event => setValues({ ...values, price_level: event.target.value })}><option value="">Not recorded</option>{[1,2,3,4].map(n => <option key={n} value={n}>{n} / 4</option>)}</select></label>
      <label>Website URL (optional) <input type="url" name="website_url" maxLength={2048} value={values.website_url} onChange={event => setValues({ ...values, website_url: event.target.value })} /></label>
      <label>Instagram URL (optional) <input type="url" name="instagram_url" maxLength={2048} value={values.instagram_url} onChange={event => setValues({ ...values, instagram_url: event.target.value })} /></label>
      <label className="admin-checkbox"><input type="checkbox" name="is_active" checked={values.is_active} onChange={event => setValues({ ...values, is_active: event.target.checked })} /> Active in public discovery</label>
      {row?.is_active && !values.is_active && <label className="admin-checkbox"><input type="checkbox" required /> I confirm deactivation; this restaurant will disappear from public discovery.</label>}
      <button className="button button-dark" type="submit">{pending ? "Saving…" : row ? "Save changes" : "Create restaurant"}</button>
    </fieldset>
    {state.error && <div role="alert"><p>{state.error}</p>{row && <a className="text-link" href={`/admin/restaurants/${row.id}/edit`}>Reload latest record (discards unsaved changes)</a>}</div>}
    <Link className="text-link" href="/admin/restaurants">Cancel</Link>
  </form>;
}

export function RestaurantStatus({ row }: { row: AdminRestaurant }) {
  const [state, action, pending] = useActionState(saveRestaurant, {});
  const [confirmedVersion, setConfirmedVersion] = useState<string | null>(null);
  const confirming = confirmedVersion === row.updated_at;
  return <form action={action}>
    <input type="hidden" name="operation" value="status" /><input type="hidden" name="id" value={row.id} /><input type="hidden" name="updated_at" value={row.updated_at} />
    {!row.is_active && <input type="hidden" name="is_active" value="on" />}
    {row.is_active && !confirming ? <button className="text-link" type="button" onClick={() => setConfirmedVersion(row.updated_at)}>Deactivate</button> : <>
      {row.is_active && <p>This restaurant will disappear from public discovery.</p>}
      <button className="text-link" disabled={pending} type="submit">{pending ? "Saving…" : row.is_active ? "Confirm deactivation" : "Reactivate"}</button>
      {row.is_active && <button className="text-link" disabled={pending} type="button" onClick={() => setConfirmedVersion(null)}>Cancel</button>}
    </>}
    {state.error && <p role="alert">{state.error} <a href="/admin/restaurants">Reload catalogue</a></p>}
    {state.savedId && <span role="status">Status saved.</span>}
  </form>;
}
