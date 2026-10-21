import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";

export const metadata: Metadata = { title: "Admin login" };

export default async function Page() {
  await requireAdmin();
  redirect("/admin");
}
