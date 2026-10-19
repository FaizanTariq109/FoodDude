import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/placeholder-page";

export const metadata: Metadata = { title: "Admin" };

export default function Page() {
  return <PlaceholderPage title="Admin" description="Future private administration area. This is a public placeholder with no authentication, private data, or admin actions." />;
}
