import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { RestaurantForm } from "@/components/admin/restaurant-form";

export default async function Page() {
  await requireAdmin();
  return <div className="container admin-page"><Link className="text-link" href="/admin/restaurants">← Restaurants</Link><header className="page-intro"><h1>Add restaurant.</h1></header><RestaurantForm /></div>;
}
