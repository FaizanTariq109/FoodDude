import type { Metadata } from "next";
import { Suspense } from "react";
import { Explorer } from "@/components/discovery/explorer";
import { connection } from "next/server";
import { getRestaurants } from "@/lib/data/restaurants";
import { enrichRestaurants } from "@/data/prototype/restaurants";
export const metadata: Metadata = { title: "Discover" };
async function DiscoverList() {
  // Keep environment validation and database access out of prerendering.
  await connection();
  let restaurants;
  try {
    restaurants = await getRestaurants();
  } catch {
    return <div className="container browse-page browse-discover">
      <div className="empty-state" role="alert">
        <h1>We couldn’t load restaurants.</h1>
        <p>Your restaurant list is temporarily unavailable. Please try again.</p>
        {/* Reload the document so retry makes a fresh server request. */}
        <a className="button button-dark" href="/discover">Try again</a>
      </div>
    </div>;
  }
  return <Explorer mode="discover" source={enrichRestaurants(restaurants)} />;
}
export default function Page() {
  return <Suspense fallback={<div className="container loading-state">Loading restaurants…</div>}><DiscoverList /></Suspense>;
}
