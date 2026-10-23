import "server-only";
import type { listSession } from "./lists";
import type { UserPlace } from "@/lib/user-places";

export async function getUserPlaces(client: Awaited<ReturnType<typeof listSession>>["client"]): Promise<UserPlace[]> {
  const places: UserPlace[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.from("user_places").select("id,name,category,area,address,google_maps_url,notes")
      .order("name").order("id").range(offset, offset + 99).abortSignal(AbortSignal.timeout(15_000));
    if (error) throw Error("Your private places couldn’t be loaded. Please try again.");
    places.push(...data);
    if (data.length < 100) return places;
  }
}
