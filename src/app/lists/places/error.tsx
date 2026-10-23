"use client";
import Link from "next/link";
import { useTransition } from "react";
export default function Error({ retry }: { retry: () => void }) {
  const [pending, startTransition] = useTransition();
  return <section className="container lists-page"><h1>My Places needs a moment.</h1><p role="alert">We couldn’t load your private places. Please try again.</p><button className="button button-dark" disabled={pending} onClick={() => startTransition(() => retry())}>{pending ? "Retrying…" : "Try again"}</button><Link href="/lists" className="back-link">My Lists</Link></section>;
}
