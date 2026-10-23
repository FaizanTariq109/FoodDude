import type { Metadata } from "next";
import { Suspense } from "react";
import { Explorer } from "@/components/discovery/explorer";
import { connection } from "next/server";
import { getRestaurants } from "@/lib/data/restaurants";
import { enrichRestaurants } from "@/data/prototype/restaurants";
export const metadata: Metadata = { title: "Restaurants" };
async function PlacesList() {
  // Keep environment validation and database access out of prerendering.
  await connection();
  let restaurants;
  try {
    restaurants = await getRestaurants();
  } catch {
    return <div className="container browse-page browse-places">
      <div className="empty-state" role="alert">
        <h1>We couldn’t load your places.</h1>
        <p>Your restaurant list is temporarily unavailable. Please try again.</p>
        {/* Reload the document so retry makes a fresh server request. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="button button-dark" href="/places">Try again</a>
      </div>
    </div>;
  }
  return <Explorer mode="places" source={enrichRestaurants(restaurants)} />;
}
export default function Page() {
  return <Suspense fallback={<div className="container loading-state">Loading restaurants…</div>}><PlacesList /></Suspense>;
}
