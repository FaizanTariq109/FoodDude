"use server";
import { revalidatePath } from "next/cache";
import { listSession } from "@/lib/data/lists";
import { getLikedPlaces } from "@/lib/data/liked-places";
import { listId } from "@/lib/lists";
import type { LikeResult } from "@/lib/liked-places";

export async function readLikedPlaces() {
  return getLikedPlaces();
}

export async function setRestaurantLiked(restaurantId: string, liked: boolean): Promise<LikeResult> {
  if (typeof restaurantId !== "string" || !listId.test(restaurantId) || typeof liked !== "boolean") return { error: "Choose a public restaurant." };
  try {
    const { client, authenticated } = await listSession();
    if (!authenticated) return { error: "Please sign in to like restaurants." };
    const { data, error } = await client.rpc("set_restaurant_liked", { p_restaurant_id: restaurantId, p_liked: liked });
    if (error || data !== liked) return { error: "Unable to update Liked Places. Please try again. The restaurant may no longer be available." };
    revalidatePath("/", "layout");
    return { snapshot: await getLikedPlaces() };
  } catch { return { error: "Liked Places is temporarily unavailable. Please try again." }; }
}
