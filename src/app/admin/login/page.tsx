import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/placeholder-page";

export const metadata: Metadata = { title: "Admin login" };

export default function Page() {
  return <PlaceholderPage title="Admin login" description="Administrator sign-in will live here. Authentication is not implemented yet." />;
}
