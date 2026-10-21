"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { mutationError, restaurantId, restaurantInput, type MutationState } from "@/lib/admin/restaurant-input";

export async function saveRestaurant(_previous: MutationState, form: FormData): Promise<MutationState> {
  try {
    const client = await createClient();
    if (await getAdminAccess(client) !== "admin") return { error: mutationError("42501") };
    const id = String(form.get("id") ?? "");
    const version = String(form.get("updated_at") ?? "");
    const toggle = form.get("operation") === "status";
    if ((id && !restaurantId.test(id)) || (toggle && !id) || (id && !Number.isFinite(Date.parse(version)))) return { error: "Invalid record reference. Reload the restaurant." };
    let fields;
    try { fields = toggle ? { p_active: form.get("is_active") === "on" } : restaurantInput(form); }
    catch (error) { return { error: error instanceof Error ? error.message : "Invalid fields." }; }
    const rpc = toggle ? "admin_set_restaurant_active" : id ? "admin_update_restaurant" : "admin_create_restaurant";
    const args = id ? { ...fields, p_id: id, p_expected_updated_at: version } : fields;
    const { data, error } = await client.rpc(rpc, args);
    if (error) return { error: mutationError(error.code) };
    if (typeof data !== "string" || !restaurantId.test(data)) return { error: mutationError() };
    revalidatePath("/admin", "layout");
    revalidatePath("/");
    revalidatePath("/places");
    revalidatePath("/places/[slug]", "page");
    return { savedId: data };
  } catch { return { error: mutationError() }; }
}
