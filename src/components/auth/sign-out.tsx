"use client";
import { useActionState } from "react";
import { logout } from "@/app/auth/actions";
import type { AuthState } from "@/lib/auth/types";

export function SignOut() {
  const [state, action, pending] = useActionState<AuthState, FormData>(logout, {});
  return <form action={action} className="sign-out-form">
    <button type="submit" disabled={pending}>{pending ? "Signing out…" : "Sign out"}</button>
    {state.message && <span role="alert" className="sign-out-error">{state.message}</span>}
  </form>;
}
