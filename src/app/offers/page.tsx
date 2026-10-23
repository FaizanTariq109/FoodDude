import type { Metadata } from "next";
import { Suspense } from "react";
import { Explorer } from "@/components/discovery/explorer";
export const metadata: Metadata = { title: "Offers" };
export default function Page() {
  return <Suspense fallback={<div className="container loading-state">Loading offers…</div>}><Explorer mode="offers" /></Suspense>;
}
