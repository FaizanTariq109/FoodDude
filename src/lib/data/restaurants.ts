import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { RestaurantCategory } from "@/types";

export interface PublicRestaurant {
  id: string;
  name: string;
  slug: string;
  category: RestaurantCategory;
}

export async function getRestaurantBySlug(slug: string): Promise<PublicRestaurant | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select("id, name, slug, category")
    .eq("slug", slug)
    .abortSignal(AbortSignal.timeout(15_000))
    .maybeSingle();

  if (error) throw new Error("Unable to load restaurant.");
  if (!data) return null;
  if (data.category !== "restaurant" && data.category !== "cafe") {
    throw new Error("Unexpected restaurant category.");
  }
  return { id: data.id, name: data.name, slug: data.slug, category: data.category };
}

export async function getRestaurants(): Promise<PublicRestaurant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select("id, name, slug, category")
    .order("slug")
    .abortSignal(AbortSignal.timeout(15_000));

  if (error) throw new Error("Unable to load restaurants.");
  return (data ?? []).map((row) => {
    if (row.category !== "restaurant" && row.category !== "cafe") {
      throw new Error("Unexpected restaurant category.");
    }
    return { id: row.id, name: row.name, slug: row.slug, category: row.category };
  });
}
