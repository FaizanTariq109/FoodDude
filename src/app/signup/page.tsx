import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
export const metadata: Metadata = { title: "Sign up" };
export default function Page() {
  return <section className="container auth-page"><div className="auth-card"><AuthForm mode="signup" /></div></section>;
}
