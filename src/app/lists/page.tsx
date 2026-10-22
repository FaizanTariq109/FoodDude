import Link from "next/link";
import { listSession, getUserLists } from "@/lib/data/lists";
import { ListForm } from "@/components/lists/list-forms";
export const metadata = { title: "My Lists", robots: { index: false, follow: false } };

export default async function Page() {
  const { client, authenticated } = await listSession();
  if (!authenticated) return <section className="container lists-page"><p className="eyebrow">YOUR OWN LITTLE COLLECTION</p><h1>A place for your plans.</h1><p>Your restaurant lists and notes are private. Sign in to see them.</p><Link href="/login" className="button button-dark">Sign in to My Lists</Link></section>;
  const lists = await getUserLists(client);
  return <div className="container lists-page"><p className="eyebrow">ONLY FOR YOU · PRIVATE LISTS</p><h1>Good places. Your plans.</h1><p>From a first date to your next coffee. Keep the places you want to come back to.</p>
    <div className="lists-layout"><section aria-label="Your lists">{lists.length ? <div className="lists-grid">{lists.map(list => <Link className="list-card" key={list.id} href={`/lists/${list.id}`}><span className="eyebrow">PRIVATE COLLECTION</span><h2>{list.name}</h2><p>{list.description || "A few good evenings waiting to happen."}</p><span className="text-link">Open list →</span></Link>)}</div> : <div className="list-card"><h2>A fresh page.</h2><p>You have no lists yet. Create one whenever you’re ready.</p><Link href="/places" className="text-link">Explore restaurants →</Link></div>}</section>
    <aside className="list-card"><h2>Make a little list.</h2><ListForm operation="create" /></aside></div></div>;
}
