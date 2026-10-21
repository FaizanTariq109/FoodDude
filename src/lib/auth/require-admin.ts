import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess } from "./admin";

/** Call before rendering admin content or accessing future privileged data/actions. */
export async function requireAdmin() {
  const access = await getAdminAccess(await createClient());
  if (access === "anonymous") redirect("/login");
  if (access === "denied") throw new Error("Access denied.");
  if (access !== "admin") throw new Error("Administrator access is temporarily unavailable.");
}
