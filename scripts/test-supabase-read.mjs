// Read-only smoke test for the anonymous Supabase Data API.
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), process.env.NODE_ENV === "development");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!url || !publishableKey) {
  console.error("FAIL configuration: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required in .env.local.");
  process.exit(1);
}

function safeMessage(error) {
  let message = error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : error instanceof Error
      ? error.message
      : String(error);
  for (const secret of [url, publishableKey]) {
    if (secret) message = message.replaceAll(secret, "[redacted]");
  }
  return message.replace(/https?:\/\/[^\s"']+/gi, "[project URL]");
}

try {
  const supabase = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    realtime: { transport: WebSocket },
  });

  const { data: restaurants, error: readError } = await supabase
    .from("restaurants")
    .select("id, name, slug, category");

  if (readError) {
    throw new Error(`Public restaurant read failed (${readError.code ?? "no code"}): ${safeMessage(readError)}`);
  }

  const records = restaurants ?? [];
  const restaurantCount = records.filter((record) => record.category === "restaurant").length;
  const cafeCount = records.filter((record) => record.category === "cafe").length;
  const uniqueSlugCount = new Set(records.map((record) => record.slug)).size;

  if (records.length !== 74 || restaurantCount !== 55 || cafeCount !== 19 || uniqueSlugCount !== records.length) {
    throw new Error(
      `Public read counts did not match: ${records.length} records, ${restaurantCount} restaurants, ${cafeCount} cafes, ${uniqueSlugCount} unique slugs.`,
    );
  }
  console.log(`PASS public read: ${records.length} records (${restaurantCount} restaurants, ${cafeCount} cafes); slugs are unique.`);

  const { data: restrictedData, error: restrictedError } = await supabase
    .from("restaurants")
    .select("personal_notes")
    .limit(1);

  if (!restrictedError) {
    throw new Error(
      restrictedData?.length
        ? "Restricted-column check failed: personal_notes was readable."
        : "Restricted-column check failed: personal_notes SELECT was not rejected.",
    );
  }
  if (restrictedError.code !== "42501") {
    throw new Error(
      `Restricted-column check returned an unexpected error (${restrictedError.code ?? "no code"}): ${safeMessage(restrictedError)}`,
    );
  }

  console.log("PASS restricted column: anonymous SELECT on personal_notes was denied by database permissions (42501).");
  console.log("PASS smoke test complete; no database writes were attempted.");
} catch (error) {
  console.error(`FAIL smoke test: ${safeMessage(error)}`);
  process.exitCode = 1;
}
