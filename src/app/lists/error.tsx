"use client";
import Link from "next/link";
export default function Error({ reset }: { reset: () => void }) {
  return <section className="container lists-page"><h1>Your lists need a moment.</h1><p role="alert">We couldn’t load your private lists. Please try again.</p><button onClick={reset} className="button button-dark">Try again</button><Link className="back-link" href="/lists">Return to My Lists</Link></section>;
}
