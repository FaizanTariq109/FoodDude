import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOut } from "./sign-out";

export async function AccountNavigation() {
  let authenticated = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    authenticated = !error && !!data?.claims?.sub;
  } catch { /* Public navigation remains available during Auth outages. */ }
  return <nav aria-label="Account" className="account-links">
    {authenticated ? <SignOut /> : <><Link href="/login">Sign in</Link><Link href="/signup">Sign up</Link></>}
  </nav>;
}
