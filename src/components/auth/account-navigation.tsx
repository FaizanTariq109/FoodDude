import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOut } from "./sign-out";
import { getAdminAccess } from "@/lib/auth/admin";
import { LayoutDashboard } from "lucide-react";

export async function AccountNavigation() {
  let authenticated = false;
  let admin = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    authenticated = !error && !!data?.claims?.sub;
    if (authenticated) admin = await getAdminAccess(supabase) === "admin";
  } catch { /* Public navigation remains available during Auth outages. */ }
  return <>
    {admin && <nav aria-label="Administration" className="admin-navigation"><Link href="/admin" aria-label="Admin Dashboard"><LayoutDashboard size={19} strokeWidth={1.6} /><span>Admin Dashboard</span></Link></nav>}
    <nav aria-label="Account" className="account-links">
      {authenticated ? <SignOut /> : <><Link className="account-button account-login" href="/login">Log in</Link><Link className="account-button account-signup" href="/signup">Sign up</Link></>}
    </nav>
  </>;
}
