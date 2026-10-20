import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { enrichRestaurants } from "@/data/prototype/restaurants";
import { getRestaurantBySlug, getRestaurants } from "@/lib/data/restaurants";
import { RestaurantDetail } from "@/components/restaurants/restaurant-detail";
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
  const source = enrichRestaurants(await getRestaurants());
  return <RestaurantDetail place={place} source={source} />;
}
