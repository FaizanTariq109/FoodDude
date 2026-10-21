import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/require-admin";
import "@/styles/admin.css";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return children;
}
