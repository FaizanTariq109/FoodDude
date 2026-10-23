import "server-only";
import { listSession } from "./lists";
import { anonymousLikes, type LikedPlacesSnapshot } from "@/lib/liked-places";

export async function getLikedPlaces(): Promise<LikedPlacesSnapshot> {
  let userId: string | null = null;
  try {
    const { client, authenticated, userId: verifiedId } = await listSession();
    if (!authenticated || !verifiedId) return anonymousLikes;
    userId = verifiedId;
    const { data: list, error } = await client.from("user_lists").select("id").eq("kind", "liked")
      .abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
    if (error || !list) throw Error("Liked Places unavailable");
    const restaurantIds: string[] = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await client.from("user_list_entries").select("restaurant_id")
        .eq("list_id", list.id).order("id").range(offset, offset + 99).abortSignal(AbortSignal.timeout(15_000));
      if (error) throw Error("Liked Places unavailable");
      restaurantIds.push(...data.flatMap(row => row.restaurant_id ? [row.restaurant_id] : []));
      if (data.length < 100) return { userId, restaurantIds, unavailable: false };
    }
  } catch { return { userId, restaurantIds: [], unavailable: true }; }
}
