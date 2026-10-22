import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminRestaurants } from "@/lib/data/admin-restaurants";
import { restaurantId } from "@/lib/admin/restaurant-input";
import { RestaurantForm } from "@/components/admin/restaurant-form";
import { AdminReadError } from "@/components/admin/read-error";
import { BranchManagement } from "@/components/admin/branch-management";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!restaurantId.test(id)) notFound();
  let rows;
  try { rows = await getAdminRestaurants(); } catch { return <div className="container admin-page"><AdminReadError href={`/admin/restaurants/${id}/edit`} /></div>; }
  const row = rows.find(row => row.id === id);
  if (!row) notFound();
  return <div className="container admin-page"><Link className="text-link" href="/admin/restaurants">← Restaurants</Link><header className="page-intro"><h1>Edit restaurant.</h1><a className="text-link" href="#branches">Manage branches for {row.name}</a></header><RestaurantForm key={row.id} row={row} /><BranchManagement restaurantId={row.id} restaurantName={row.name} /></div>;
}
