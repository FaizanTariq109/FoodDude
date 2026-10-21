import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminAccess = "anonymous" | "denied" | "admin" | "unavailable";

/** User-scoped client only. Never trust role metadata or persist this result. */
export async function getAdminAccess(supabase: SupabaseClient): Promise<AdminAccess> {
  try {
    const { data: identity, error: authError } = await supabase.auth.getClaims();
    if (authError || !identity?.claims?.sub) return "anonymous";

    const { data, error } = await supabase.rpc("current_user_is_admin");
    if (error || typeof data !== "boolean") return "unavailable";
    return data === true ? "admin" : "denied";
  } catch {
    return "unavailable";
  }
}
