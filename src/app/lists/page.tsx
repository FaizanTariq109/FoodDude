import Link from "next/link";
import { listSession, getListSummaries } from "@/lib/data/lists";
import { ListOverview } from "@/components/lists/list-overview";
export const metadata = { title: "My Lists", robots: { index: false, follow: false } };

export default async function Page() {
  const { client, authenticated } = await listSession();
  if (!authenticated) return <section className="container lists-page"><h1>My Lists</h1><p>Your restaurant lists and notes are private. Sign in to see them.</p><Link href="/login" className="button button-dark">Sign in to My Lists</Link></section>;
  return <ListOverview lists={await getListSummaries(client)} />;
}
