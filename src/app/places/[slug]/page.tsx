import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache, Suspense } from "react";
import { enrichRestaurants } from "@/data/prototype/restaurants";
import { getRestaurantBySlug, getRestaurants } from "@/lib/data/restaurants";
import { RestaurantDetail } from "@/components/restaurants/restaurant-detail";
import { getPublicBranches } from "@/lib/data/branches";
import { SaveRestaurant } from "@/components/lists/save-restaurant";
const getPlace = cache(async (slug: string) => {
  await connection();
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) notFound();
  return enrichRestaurants([restaurant])[0];
});
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlace(slug);
  return { title: place.name };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = await getPlace(slug);
  const [restaurants, branchResult] = await Promise.all([
    getRestaurants(),
    getPublicBranches(place.id).then(branches => ({ branches, unavailable: false })).catch(() => ({ branches: [], unavailable: true })),
  ]);
  const source = enrichRestaurants(restaurants);
  return <RestaurantDetail place={place} source={source} branches={branchResult.branches} branchesUnavailable={branchResult.unavailable} saveControl={<Suspense fallback={<button type="button" className="button button-outline save-to-list-trigger" disabled aria-busy="true">Loading lists…</button>}><SaveRestaurant restaurantId={place.id} /></Suspense>} />;
}
