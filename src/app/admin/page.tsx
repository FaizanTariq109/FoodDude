import type { Metadata } from "next";
import Link from "next/link";
import { getAdminRestaurants } from "@/lib/data/admin-restaurants";
import { restaurantCounts } from "@/lib/admin/restaurants";
import { AdminReadError } from "@/components/admin/read-error";
import { requireAdmin } from "@/lib/auth/require-admin";

export const metadata: Metadata = { title: "Admin" };

export default async function Page() {
  await requireAdmin();
  let rows;
  try { rows = await getAdminRestaurants(); } catch {
    return <div className="container admin-page"><AdminReadError href="/admin" /></div>;
  }
  const counts = restaurantCounts(rows);
  const metrics = [["Total restaurants & cafes", counts.total], ["Restaurants", counts.restaurants],
    ["Cafes", counts.cafes], ["Active", counts.active], ["Inactive", counts.inactive]] as const;
  return <div className="container admin-page">
    <header className="page-intro"><div><p className="eyebrow">FoodDude administration · Read only</p>
      <h1>A look at the catalogue.</h1><p className="intro-copy">Restaurant and cafe records, including places that are currently inactive.</p></div></header>
    <dl className="admin-metrics">{metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <section className="admin-panel"><p className="eyebrow">Restaurant management</p><h2>Every place, in one view.</h2>
      <p>Browse official metadata, search by name, and filter the catalogue by category or status.</p>
      {rows.length === 0 && <p>No restaurants have been added to the catalogue yet.</p>}
      <Link className="button button-dark" href="/admin/restaurants">Browse restaurants →</Link>
    </section>
  </div>;
}
