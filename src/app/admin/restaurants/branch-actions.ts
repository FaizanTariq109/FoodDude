"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { restaurantId, type MutationState } from "@/lib/admin/restaurant-input";
import { branchInput, branchError } from "@/lib/admin/branch-input";

export async function saveBranch(_previous: MutationState, form: FormData): Promise<MutationState> {
  try {
    const client = await createClient();
    if (await getAdminAccess(client) !== "admin") return { error: branchError("42501") };
    const parent = String(form.get("restaurant_id") ?? ""), id = String(form.get("id") ?? "");
    const version = String(form.get("updated_at") ?? ""), status = form.get("operation") === "status";
    if (!restaurantId.test(parent) || (id && !restaurantId.test(id)) || (status && !id) ||
      (id && !Number.isFinite(Date.parse(version)))) return { error: "Invalid branch reference. Reload the restaurant." };
    let fields;
    try { fields = status ? { p_active: form.get("is_active") === "on" } : branchInput(form); }
    catch (error) { return { error: error instanceof Error ? error.message : "Invalid branch fields." }; }
    const args = { ...fields, p_restaurant_id: parent, ...(id ? { p_id: id, p_expected_updated_at: version } : {}) };
    const rpc = status ? "admin_set_branch_active" : id ? "admin_update_branch" : "admin_create_branch";
    const { data, error } = await client.rpc(rpc, args);
    if (error) return { error: branchError(error.code) };
    if (typeof data !== "string" || !restaurantId.test(data)) return { error: branchError() };
    revalidatePath("/admin", "layout");
    revalidatePath("/places/[slug]", "page");
    return { savedId: data };
  } catch { return { error: branchError() }; }
}
