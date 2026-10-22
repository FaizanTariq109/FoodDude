import Link from "next/link";
import { notFound } from "next/navigation";
import { listSession } from "@/lib/data/lists";
import { listId } from "@/lib/lists";
import { ListForm } from "@/components/lists/list-forms";
export const metadata = { title: "Private list", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client, authenticated } = await listSession();
  if (!authenticated) return <section className="container lists-page"><h1>Your lists are private.</h1><p>Sign in to open your saved restaurants.</p><Link href="/login" className="button button-dark">Sign in to My Lists</Link></section>;
  if (!listId.test(id)) notFound();
  const { data: list, error } = await client.from("user_lists").select("id,name,description").eq("id", id).abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
  if (error) throw Error("Unable to load your list.");
  if (!list) notFound();
  const entries: { id: string; restaurant_id: string; notes: string | null }[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.from("user_list_entries").select("id,restaurant_id,notes").eq("list_id", id).order("created_at", { ascending: false }).order("id").range(offset, offset + 99).abortSignal(AbortSignal.timeout(15_000));
    if (error) throw Error("Unable to load saved restaurants.");
    entries.push(...data);
    if (data.length < 100) break;
  }
  // Resolve public identity separately: unavailable references never carry a name/slug snapshot.
  const restaurants: { id: string; name: string; slug: string }[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.from("restaurants").select("id,name,slug").order("name").order("id").range(offset, offset + 99).abortSignal(AbortSignal.timeout(15_000));
    if (error) throw Error("Unable to load public restaurants.");
    restaurants.push(...data);
    if (data.length < 100) break;
  }
  const publicById = new Map(restaurants.map(row => [row.id, row]));
  const saved = new Set(entries.map(entry => entry.restaurant_id));
  return <div className="container lists-page"><Link href="/lists" className="back-link">← My Lists</Link><p className="eyebrow">PRIVATE COLLECTION · ONLY YOU</p><h1>{list.name}</h1>{list.description && <p className="list-description">{list.description}</p>}<p>{entries.length} saved {entries.length === 1 ? "restaurant" : "restaurants"}</p>
    <div className="lists-layout"><section aria-label="Saved restaurants" className="saved-entries">{entries.length === 0 && <div className="list-card"><h2>Where shall we go?</h2><p>Add a public restaurant to start this collection.</p></div>}{entries.map(entry => {
      const restaurant = publicById.get(entry.restaurant_id);
      return <article className="list-card" key={entry.id}><h2>{restaurant ? <Link href={`/places/${restaurant.slug}`}>{restaurant.name} ↗</Link> : "Restaurant unavailable"}</h2>{!restaurant && <p>This restaurant is no longer publicly available. Your saved entry and private note are preserved.</p>}<ListForm operation="notes" list={list} entryId={entry.id} notes={entry.notes} /><ListForm operation="remove" list={list} entryId={entry.id} /></article>;
    })}</section><aside className="saved-entries"><section className="list-card"><h2>Add somewhere good.</h2>{restaurants.some(row => !saved.has(row.id)) ? <ListForm operation="add" list={list} restaurants={restaurants.filter(row => !saved.has(row.id))} /> : <p>No more public restaurants to add right now.</p>}</section>
    <section className="list-card"><h2>Edit your list.</h2><ListForm operation="edit" list={list} /></section><details className="list-card"><summary>Delete this list</summary><ListForm operation="delete" list={list} /></details></aside></div></div>;
}
