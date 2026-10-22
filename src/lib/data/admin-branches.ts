import "server-only";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import type { AdminBranch } from "@/lib/branches";

export async function getAdminBranches(restaurantId: string): Promise<AdminBranch[]> {
  await requireAdmin();
  const client = await createClient();
  const rows: AdminBranch[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.rpc("admin_restaurant_branches", { p_restaurant_id: restaurantId })
      .order("id").range(offset, offset + 99).abortSignal(AbortSignal.timeout(15_000));
    if (error || !Array.isArray(data)) throw Error("Unable to load administrator branches.");
    for (const row of data) {
      if (row.restaurant_id !== restaurantId || typeof row.is_active !== "boolean") throw Error("Unexpected branch record.");
      rows.push({ id: row.id, restaurant_id: row.restaurant_id, name: row.name, area: row.area,
        address: row.address, phone: row.phone, google_maps_url: row.google_maps_url,
        latitude: row.latitude, longitude: row.longitude, is_active: row.is_active,
        created_at: row.created_at, updated_at: row.updated_at });
    }
    if (data.length < 100) return rows;
  }
}
