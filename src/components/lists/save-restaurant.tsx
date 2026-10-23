import { listSession, getUserLists, getSavedListIds } from "@/lib/data/lists";
import { SaveToLists } from "./save-to-lists";
import type { UserList } from "@/lib/lists";

export async function SaveRestaurant({ restaurantId }: { restaurantId: string }) {
  let authenticated = false;
  let unavailable = false;
  let lists: UserList[] = [];
  let savedIds: string[] = [];
  try {
    const session = await listSession();
    authenticated = session.authenticated;
    if (authenticated) [lists, savedIds] = await Promise.all([getUserLists(session.client), getSavedListIds(session.client, restaurantId)]);
  } catch { unavailable = true; }
  return <SaveToLists restaurantId={restaurantId} authenticated={authenticated} lists={lists.filter(list => list.kind !== "liked")} savedIds={savedIds} unavailable={unavailable} />;
}
