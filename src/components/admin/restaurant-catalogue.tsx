"use client";

import { useState } from "react";
import Link from "next/link";
import { RestaurantStatus } from "./restaurant-form";
import { filterRestaurants, officialUrl, restaurantFilters, type AdminRestaurant } from "@/lib/admin/restaurants";

function OfficialLink({ value, label }: { value: string | null; label: string }) {
  const href = officialUrl(value);
  return href ? <a href={href} target="_blank" rel="noopener noreferrer">{label} ↗</a> : null;
}

export function RestaurantCatalogue({ rows, initialFilters }: {
  rows: AdminRestaurant[];
  initialFilters: ReturnType<typeof restaurantFilters>;
}) {
  const [search, setSearch] = useState(initialFilters.q);
  const [draft, setDraft] = useState({ category: initialFilters.category, status: initialFilters.status });
  const [applied, setApplied] = useState(draft);
  const results = filterRestaurants(rows, { ...applied, q: search });
  function clearFilters() {
    const reset = { category: "all", status: "all" };
    setDraft(reset);
    setApplied(reset);
  }
  return <>
    <form className="admin-filters" aria-label="Restaurant filters" onSubmit={event => {
      event.preventDefault();
      setApplied({ ...draft });
    }}>
      <label>Category<select name="category" value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}><option value="all">All categories</option><option value="restaurant">Restaurants</option><option value="cafe">Cafes</option></select></label>
      <label>Status<select name="status" value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
      <button className="button button-dark" type="submit">Apply filters</button>
      <button className="text-link" type="button" onClick={clearFilters}>Clear filters</button>
    </form>
    <section className="admin-search" aria-label="Restaurant search">
      <label htmlFor="restaurant-search">Search restaurants</label>
      <div className="admin-search-controls">
        <input id="restaurant-search" type="search" value={search} maxLength={200}
          onChange={event => setSearch(event.target.value)} placeholder="Restaurant or cafe name" />
        <button className="text-link" type="button" onClick={() => setSearch("")} disabled={search.length === 0}>Clear search</button>
      </div>
    </section>
    <p className="admin-result-count" role="status" aria-live="polite" aria-atomic="true">Showing {results.length} of {rows.length} places</p>
    {results.length === 0 ? <section className="admin-empty"><h2>{rows.length === 0 ? "The catalogue is empty" : "No matching places"}</h2>
      <p>{rows.length === 0 ? "There are no restaurant records to display yet." : "Try a different name or clear the filters to see all places."}</p>
      {rows.length > 0 && <button className="button button-dark" type="button" onClick={clearFilters}>Clear filters</button>}
    </section> : <div className="admin-table-wrap"><table className="admin-table">
      <caption className="sr-only">Restaurant catalogue and official metadata</caption>
      <thead><tr><th scope="col">Name / slug</th><th scope="col">Category</th><th scope="col">Status</th><th scope="col">Official metadata</th></tr></thead>
      <tbody>{results.map(row => <tr key={row.id}>
        <td data-label="Name / slug"><strong>{row.name}</strong><span className="admin-slug">{row.slug}</span><div className="admin-row-actions"><Link className="text-link" href={`/admin/restaurants/${row.id}/edit`}>Edit<span className="sr-only"> {row.name}</span></Link><RestaurantStatus row={row} /></div></td>
        <td data-label="Category">{row.category === "cafe" ? "Cafe" : "Restaurant"}</td>
        <td data-label="Status"><span className={`admin-status ${row.is_active ? "is-active" : ""}`}>{row.is_active ? "Active" : "Inactive"}</span></td>
        <td data-label="Official metadata"><div className="admin-metadata">
          <p>{row.short_description || "No official description available."}</p>
          <span>Price level: {row.price_level === null ? "Not recorded" : `${row.price_level} / 4`}</span>
          <div className="admin-official-links"><OfficialLink value={row.website_url} label="Website" /><OfficialLink value={row.instagram_url} label="Instagram" />
            {!officialUrl(row.website_url) && !officialUrl(row.instagram_url) && <span>No official links recorded</span>}</div>
          <details><summary>Record details</summary><dl><dt>ID</dt><dd>{row.id}</dd><dt>Created (UTC)</dt><dd><time dateTime={row.created_at}>{new Date(row.created_at).toISOString().replace("T", " ")}</time></dd>
            <dt>Updated (UTC)</dt><dd><time dateTime={row.updated_at}>{new Date(row.updated_at).toISOString().replace("T", " ")}</time></dd></dl></details>
        </div></td>
      </tr>)}</tbody>
    </table></div>}
  </>;
}
