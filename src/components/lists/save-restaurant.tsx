import Link from "next/link";
import { listSession, getUserLists } from "@/lib/data/lists";
import { ListForm } from "./list-forms";
import type { UserList } from "@/lib/lists";

export async function SaveRestaurant({ restaurantId }: { restaurantId: string }) {
  let authenticated = false;
  let unavailable = false;
  let lists: UserList[] = [];
  try {
    const session = await listSession();
    authenticated = session.authenticated;
    if (authenticated) lists = await getUserLists(session.client);
  } catch { unavailable = true; }
  if (unavailable) return <section className="list-save"><p role="status">Private lists are temporarily unavailable. Please try again later.</p><Link href="/lists">My Lists →</Link></section>;
  if (!authenticated) return <section className="list-save"><h2>Keep it for later.</h2><p>Save restaurants and private notes in your own lists.</p><Link className="text-link" href="/login">Sign in to save →</Link></section>;
  return <section className="list-save"><p className="eyebrow">ONLY FOR YOU</p><h2>Save to a private list.</h2>{lists.length ? <ListForm operation="add" lists={lists} restaurantId={restaurantId} /> : <p>Create your first list to save this restaurant.</p>}<Link className="text-link" href="/lists">{lists.length ? "Manage My Lists →" : "Create a list →"}</Link></section>;
}
