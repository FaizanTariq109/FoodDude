import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { RestaurantCategory } from "@/types";

export interface PublicRestaurant {
  id: string;
  name: string;
  slug: string;
  category: RestaurantCategory;
  short_description: string | null;
  price_level: number | null;
  website_url: string | null;
  instagram_url: string | null;
}

// Explicit projection: never select legacy personal fields or use table-wide '*'.
const publicColumns = "id, name, slug, category, short_description, price_level, website_url, instagram_url";

function publicRestaurant(row: PublicRestaurant): PublicRestaurant {
  if (row.category !== "restaurant" && row.category !== "cafe") {
    throw new Error("Unexpected restaurant category.");
  }
  return { id: row.id, name: row.name, slug: row.slug, category: row.category,
    short_description: row.short_description, price_level: row.price_level,
    website_url: row.website_url, instagram_url: row.instagram_url };
}

// Per-request SSR client; no cross-request caching of catalogue records.
export async function getRestaurantBySlug(slug: string): Promise<PublicRestaurant | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select(publicColumns)
    .eq("slug", slug)
    .abortSignal(AbortSignal.timeout(15_000))
    .maybeSingle();

  if (error) throw new Error("Unable to load restaurant.");
  if (!data) return null;
  return publicRestaurant(data);
}

export async function getRestaurants(): Promise<PublicRestaurant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select(publicColumns)
    .order("slug")
    .abortSignal(AbortSignal.timeout(15_000));

  if (error) throw new Error("Unable to load restaurants.");
  return (data ?? []).map(publicRestaurant);
}
