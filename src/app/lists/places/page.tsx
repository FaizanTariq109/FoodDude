import Link from "next/link";
import { listSession } from "@/lib/data/lists";
import { getUserPlaces } from "@/lib/data/user-places";
import { UserPlaces } from "@/components/lists/user-places";
export const metadata = { title: "My Places", robots: { index: false, follow: false } };
export default async function Page() {
  const { client, authenticated } = await listSession();
  if (!authenticated) return <section className="container lists-page"><h1>My Places</h1><p>Your custom places are private. Sign in to manage them.</p><Link href="/login" className="button button-dark">Sign in to My Places</Link></section>;
  return <UserPlaces places={await getUserPlaces(client)} />;
}
