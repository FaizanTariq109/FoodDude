import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminRestaurants } from "@/lib/data/admin-restaurants";
import { restaurantFilters, type SearchParams } from "@/lib/admin/restaurants";
import { AdminReadError } from "@/components/admin/read-error";
import { RestaurantCatalogue } from "@/components/admin/restaurant-catalogue";

export const metadata: Metadata = { title: "Restaurant management" };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const filters = restaurantFilters(await searchParams);
  let rows;
  try { rows = await getAdminRestaurants(); } catch {
    return <div className="container admin-page"><Link className="text-link" href="/admin">← Dashboard</Link><AdminReadError href="/admin/restaurants" /></div>;
  }

  return <div className="container admin-page">
    <Link className="text-link" href="/admin">← Dashboard</Link>
    <header className="page-intro"><div><p className="eyebrow">Catalogue · Administration</p><h1>Restaurants & cafes.</h1>
      <p className="intro-copy">Official records from the FoodDude catalogue. Active and inactive places are included.</p></div></header>
    <Link className="button button-dark admin-add" href="/admin/restaurants/new">Add restaurant</Link>
    <RestaurantCatalogue rows={rows} initialFilters={filters} />
  </div>;
}
