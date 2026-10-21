import "server-only";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import type { AdminRestaurant } from "@/lib/admin/restaurants";

/** User-scoped SSR client; never cache privileged records across requests. */
export async function getAdminRestaurants(): Promise<AdminRestaurant[]> {
  await requireAdmin();
  const supabase = await createClient();
  const rows: AdminRestaurant[] = [];
  // Stay below the API row cap and avoid silently truncating a growing catalogue.
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.rpc("admin_restaurants")
      .order("slug").range(offset, offset + pageSize - 1)
      .abortSignal(AbortSignal.timeout(15_000));
    if (error || !Array.isArray(data)) throw new Error("Unable to load administrator restaurant records.");
    for (const row of data) {
      if ((row.category !== "restaurant" && row.category !== "cafe") || typeof row.is_active !== "boolean") {
        throw new Error("Unexpected administrator restaurant record.");
      }
      rows.push({ id: row.id, name: row.name, slug: row.slug, category: row.category,
        short_description: row.short_description, price_level: row.price_level,
        instagram_url: row.instagram_url, website_url: row.website_url,
        is_active: row.is_active, created_at: row.created_at, updated_at: row.updated_at });
    }
    if (data.length < pageSize) return rows;
  }
}
