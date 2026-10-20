/** Read on demand so importing helpers does not require configuration. */
export function getSupabaseEnv() {
  // Static property access lets Next.js inline public values in browser builds.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url) {
    throw new Error("Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL.");
  }
  if (!publishableKey) {
    throw new Error(
      "Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return { url, publishableKey };
}
