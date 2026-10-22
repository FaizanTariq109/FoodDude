import { getAdminBranches } from "@/lib/data/admin-branches";
import { BranchForm } from "./branch-form";

export async function BranchManagement({ restaurantId, restaurantName }: { restaurantId: string; restaurantName: string }) {
  let rows;
  try { rows = await getAdminBranches(restaurantId); }
  catch { return <section id="branches" className="admin-branches admin-panel"><h2>Branches.</h2><p role="alert">Branch information is unavailable. Reload before making changes.</p><a className="text-link" href={`/admin/restaurants/${restaurantId}/edit#branches`}>Reload branches</a></section>; }
  return <section id="branches" className="admin-branches" aria-label={`Branches for ${restaurantName}`}>
    <div className="page-intro"><p className="eyebrow">{restaurantName}</p><h2>Branches.</h2><p>{rows.length} {rows.length === 1 ? "branch" : "branches"} · {rows.filter(row => row.is_active).length} active. Branches stay attached to this restaurant.</p></div>
    {!rows.length && <p className="admin-panel">No branches have been entered. Add only verified locations for {restaurantName}.</p>}
    <div className="admin-branch-list">{rows.map(row => <article className="admin-panel" key={`${row.id}:${row.updated_at}`}>
      <h3>{row.name || row.area || "Unnamed branch"}</h3><span className={`admin-status ${row.is_active ? "is-active" : ""}`}>{row.is_active ? "Active" : "Inactive"}</span>
      {row.area && <p>{row.area}</p>}{row.address && <p>{row.address}</p>}{row.phone && <p>{row.phone}</p>}
      <details><summary>Edit branch details</summary><BranchForm restaurantId={restaurantId} row={row} /></details>
      <details><summary>{row.is_active ? "Deactivate" : "Reactivate"} branch</summary><BranchForm restaurantId={restaurantId} row={row} statusOnly /></details>
    </article>)}</div>
    <details className="admin-panel"><summary>Add a branch</summary><BranchForm restaurantId={restaurantId} /></details>
  </section>;
}
