import { HomeExperience } from "@/components/discovery/home-experience";
import { connection } from "next/server";
import { getRestaurants } from "@/lib/data/restaurants";

export default async function Page() {
  await connection();
  let restaurants;
  try {
    restaurants = await getRestaurants();
  } catch {
    return <div className="container browse-page">
      <div className="empty-state" role="alert">
        <h1>We couldn’t load restaurants.</h1>
        <p>Your restaurant list is temporarily unavailable. Please try again.</p>
        {/* Reload the document so retry makes a fresh server request. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="button button-dark" href="/">Try again</a>
      </div>
    </div>;
  }
  return <HomeExperience restaurants={restaurants} />;
}
