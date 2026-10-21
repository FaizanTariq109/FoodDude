"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/auth/origin";
import type { AuthState } from "@/lib/auth/types";

function credentials(form: FormData, signup = false) {
  const value = (name: string) => typeof form.get(name) === "string" ? String(form.get(name)) : "";
  const email = value("email").trim();
  const password = value("password");
  const errors: NonNullable<AuthState["errors"]> = {};
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Enter your password.";
  else if (signup && password.length < 8) errors.password = "Use at least 8 characters.";
  if (signup && value("confirmPassword") !== password) errors.confirmPassword = "Your passwords must match.";
  return { email, password, errors };
}

export async function signup(_previous: AuthState, form: FormData): Promise<AuthState> {
  const { email, password, errors } = credentials(form, true);
  if (Object.keys(errors).length) return { errors };
  try {
    const emailRedirectTo = getAppOrigin();
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
    // Existing accounts get the same confirmation state as new accounts.
    if (error && !["user_already_exists", "email_exists"].includes(error.code ?? "")) {
      return { message: "We couldn’t complete signup. Please try again later." };
    }
    return { checkEmail: true };
  } catch {
    return { message: "We couldn’t complete signup. Please try again later." };
  }
}

export async function login(_previous: AuthState, form: FormData): Promise<AuthState> {
  const { email, password, errors } = credentials(form);
  if (Object.keys(errors).length) return { errors };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error?.code === "email_not_confirmed") {
      return { message: "Please confirm your email before signing in. Check your inbox for the confirmation link." };
    }
    if (error) return { message: "We couldn’t sign you in. Check your email and password, then try again." };
  } catch {
    return { message: "Sign in is temporarily unavailable. Please try again." };
  }
  revalidatePath("/", "layout");
  redirect("/places");
}

export async function logout(): Promise<AuthState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { message: "We couldn’t sign you out. Please try again." };
  } catch {
    return { message: "We couldn’t sign you out. Please try again." };
  }
  revalidatePath("/", "layout");
  redirect("/");
}
