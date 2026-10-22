import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { UserList } from "@/lib/lists";

export async function listSession() {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  return { client, authenticated: !error && !!data?.claims?.sub };
}

// Per-request, RLS-scoped reads; page through the API cap without a list limit.
export async function getUserLists(client: Awaited<ReturnType<typeof createClient>>): Promise<UserList[]> {
  const rows: UserList[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.from("user_lists").select("id,name,description")
      .order("created_at", { ascending: false }).order("id").range(offset, offset + 99)
      .abortSignal(AbortSignal.timeout(15_000));
    if (error) throw Error("Your lists are temporarily unavailable. Please try again.");
    rows.push(...data);
    if (data.length < 100) return rows;
  }
}
