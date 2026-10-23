import Link from "next/link";
import { notFound } from "next/navigation";
import { listSession } from "@/lib/data/lists";
import { listId } from "@/lib/lists";
import { ListDetail } from "@/components/lists/list-detail";
import type { ListRestaurant, SavedEntry } from "@/lib/lists";
import { getUserPlaces } from "@/lib/data/user-places";
export const metadata = { title: "Private list", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client, authenticated } = await listSession();
  if (!authenticated) return <section className="container lists-page"><h1>Your lists are private.</h1><p>Sign in to open your saved restaurants.</p><Link href="/login" className="button button-dark">Sign in to My Lists</Link></section>;
  if (!listId.test(id)) notFound();
  const { data: list, error } = await client.from("user_lists").select("id,name,description,kind").eq("id", id).abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
  if (error) throw Error("Unable to load your list.");
  if (!list) notFound();
  // Once the list is owner-authorized, these three reads are independent.
  // Keep private data request-scoped; failures retain the existing UI semantics.
  const readEntries = async () => {
  const entries: SavedEntry[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.from("user_list_entries").select("id,restaurant_id,user_place_id,notes").eq("list_id", id).order("created_at", { ascending: false }).order("id").range(offset, offset + 99).abortSignal(AbortSignal.timeout(15_000));
    if (error) throw Error("Unable to load saved restaurants.");
    entries.push(...data);
    if (data.length < 100) break;
  }
  return entries;
  };
  // Resolve public identity separately: unavailable references never carry a name/slug snapshot.
  const readPublic = async () => {
  const restaurants: ListRestaurant[] = [];
  let catalogueUnavailable = false;
  try {
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await client.from("restaurants").select("id,name,slug,category").order("name").order("id").range(offset, offset + 99).abortSignal(AbortSignal.timeout(15_000));
      if (error) throw Error("Unable to load public restaurants.");
      restaurants.push(...data);
      if (data.length < 100) break;
    }
  } catch { catalogueUnavailable = true; restaurants.length = 0; }
  return { restaurants, catalogueUnavailable };
  };
  const [entries, publicResult, privateResult] = await Promise.all([
    readEntries(), readPublic(),
    getUserPlaces(client).then(places => ({ places, unavailable: false })).catch(() => ({ places: [], unavailable: true })),
  ]);
  const restaurants: ListRestaurant[] = [...publicResult.restaurants, ...privateResult.places.map(place => ({ id: place.id, name: place.name, category: place.category, area: place.area, photo_object_id: place.photo_object_id, slug: "", private: true }))];
  const catalogueUnavailable = publicResult.catalogueUnavailable || privateResult.unavailable;
  return <ListDetail list={list} entries={entries} restaurants={restaurants} catalogueUnavailable={catalogueUnavailable} />;
}
