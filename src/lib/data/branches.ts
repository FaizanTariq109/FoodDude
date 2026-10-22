import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PublicBranch } from "@/lib/branches";

const columns = "id,restaurant_id,name,area,address,phone,google_maps_url,latitude,longitude";
export async function getPublicBranches(restaurantId: string): Promise<PublicBranch[]> {
  const client = await createClient();
  const rows: PublicBranch[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.from("restaurant_branches").select(columns)
      .eq("restaurant_id", restaurantId).order("id").range(offset, offset + 99)
      .abortSignal(AbortSignal.timeout(15_000));
    if (error || !Array.isArray(data)) throw Error("Unable to load branch information.");
    for (const row of data) rows.push({ id: row.id, restaurant_id: row.restaurant_id, name: row.name,
      area: row.area, address: row.address, phone: row.phone, google_maps_url: row.google_maps_url,
      latitude: row.latitude, longitude: row.longitude });
    if (data.length < 100) return rows;
  }
}
