import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/ui/placeholder-page";
import { requireAdmin } from "@/lib/auth/require-admin";

export const metadata: Metadata = { title: "Admin" };

export default async function Page() {
  await requireAdmin();
  return <PlaceholderPage title="Admin" description="Administrator dashboard. Restaurant management and other admin tools are coming later." />;
}
