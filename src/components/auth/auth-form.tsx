"use client";
import Link from "next/link";
import { useActionState } from "react";
import { signup, login } from "@/app/auth/actions";
import type { AuthState } from "@/lib/auth/types";

export function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const registering = mode === "signup";
  const [state, action, pending] = useActionState<AuthState, FormData>(registering ? signup : login, {});
  if (state.checkEmail) return <div className="auth-confirmation" role="status">
    <p className="eyebrow">EMAIL CONFIRMATION</p><h1>Check your email.</h1>
    <p>If your address is eligible, you’ll receive a link to confirm your account. Check your inbox and spam folder.</p>
    <Link href="/login" className="button button-dark">Go to log in</Link>
  </div>;
  return <>
    <h1>{registering ? "Create account" : "Log in"}</h1>
    <p className="auth-intro">{registering ? "Save restaurants in your own private lists." : "Sign in to your FoodDude account."}</p>
    <form action={action} className="auth-form" aria-label={registering ? "Sign up" : "Sign in"} aria-busy={pending}>
      {state.message && <p className="auth-message" role="alert">{state.message}</p>}
      <label htmlFor="auth-email">Email</label>
      <input id="auth-email" name="email" type="email" autoComplete="email" required maxLength={254} aria-invalid={!!state.errors?.email} aria-describedby={state.errors?.email ? "auth-email-error" : undefined} />
      {state.errors?.email && <p id="auth-email-error" className="auth-field-error" role="alert">{state.errors.email}</p>}
      <label htmlFor="auth-password">Password</label>
      <input id="auth-password" name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} required minLength={registering ? 8 : undefined} aria-invalid={!!state.errors?.password} aria-describedby={registering || state.errors?.password ? "auth-password-help" : undefined} />
      {(registering || state.errors?.password) && <p id="auth-password-help" className={state.errors?.password ? "auth-field-error" : "auth-hint"} role={state.errors?.password ? "alert" : undefined}>{state.errors?.password || "Use at least 8 characters."}</p>}
      {registering && <>
        <label htmlFor="auth-confirm">Confirm password</label>
        <input id="auth-confirm" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} aria-invalid={!!state.errors?.confirmPassword} aria-describedby={state.errors?.confirmPassword ? "auth-confirm-error" : undefined} />
        {state.errors?.confirmPassword && <p id="auth-confirm-error" className="auth-field-error" role="alert">{state.errors.confirmPassword}</p>}
      </>}
      <button type="submit" className="button button-dark" disabled={pending}>{pending ? "Please wait…" : registering ? "Create account" : "Sign in"}</button>
    </form>
    <p className="auth-alternate">{registering ? "Already have an account? " : "New to FoodDude? "}<Link href={registering ? "/login" : "/signup"}>{registering ? "Sign in" : "Sign up"}</Link></p>
    <Link className="auth-browse" href="/discover">Keep exploring Lahore →</Link>
  </>;
}
