import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOut } from "./sign-out";
import { getAdminAccess } from "@/lib/auth/admin";

export async function AccountNavigation() {
  let authenticated = false;
  let admin = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    authenticated = !error && !!data?.claims?.sub;
    if (authenticated) admin = await getAdminAccess(supabase) === "admin";
  } catch { /* Public navigation remains available during Auth outages. */ }
  return <nav aria-label="Account" className="account-links">
    {authenticated ? <><Link href="/lists">My Lists</Link>{admin && <Link href="/admin">Admin</Link>}<SignOut /></> : <><Link href="/login">Sign in</Link><Link href="/signup">Sign up</Link></>}
  </nav>;
}
