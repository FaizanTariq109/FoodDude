import type { Metadata } from "next";
import { Suspense } from "react";
import { Explorer } from "@/components/discovery/explorer";
export const metadata: Metadata = { title: "Discover" };
export default function Page() {
  return <Suspense fallback={<div className="container loading-state">Getting your Lahore list ready…</div>}><Explorer mode="discover" /></Suspense>;
}
