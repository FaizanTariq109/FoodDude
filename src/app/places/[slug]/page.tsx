import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { places } from "@/data/prototype/restaurants";
import { RestaurantDetail } from "@/components/restaurants/restaurant-detail";
export function generateStaticParams() { return places.map(place => ({ slug: place.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: places.find(place => place.slug === slug)?.name ?? "Place not found" };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = places.find(place => place.slug === slug);
  if (!place) notFound();
  return <RestaurantDetail place={place} />;
}
