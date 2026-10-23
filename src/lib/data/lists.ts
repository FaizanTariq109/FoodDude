import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { UserList, ListSummary } from "@/lib/lists";

export async function listSession() {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  return { client, authenticated: !error && !!data?.claims?.sub, userId: error ? null : data?.claims?.sub ?? null };
}

export async function getListSummaries(client: Awaited<ReturnType<typeof createClient>>): Promise<ListSummary[]> {
  const rows: ListSummary[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.from("user_lists").select("id,name,description,kind,user_list_entries(count)")
      .order("created_at", { ascending: false }).order("id").range(offset, offset + 99)
      .abortSignal(AbortSignal.timeout(15_000));
    if (error) throw Error("Your lists are temporarily unavailable. Please try again.");
    rows.push(...data.map(row => ({ id: row.id, name: row.name, description: row.description, kind: row.kind,
      restaurantCount: row.user_list_entries?.[0]?.count ?? 0 })));
    if (data.length < 100) return rows;
  }
}

export async function getSavedListIds(client: Awaited<ReturnType<typeof createClient>>, restaurantId: string): Promise<string[]> {
  const ids: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.from("user_list_entries").select("list_id").eq("restaurant_id", restaurantId)
      .order("id").range(offset, offset + 99).abortSignal(AbortSignal.timeout(15_000));
    if (error) throw Error("Unable to load saved lists.");
    ids.push(...data.map(row => row.list_id));
    if (data.length < 100) return ids;
  }
}

// Per-request, RLS-scoped reads; page through the API cap without a list limit.
export async function getUserLists(client: Awaited<ReturnType<typeof createClient>>): Promise<UserList[]> {
  const rows: UserList[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.from("user_lists").select("id,name,description,kind")
      .order("created_at", { ascending: false }).order("id").range(offset, offset + 99)
      .abortSignal(AbortSignal.timeout(15_000));
    if (error) throw Error("Your lists are temporarily unavailable. Please try again.");
    rows.push(...data);
    if (data.length < 100) return rows;
  }
}
