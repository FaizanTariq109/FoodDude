// Anonymous SELECT probes only. Never writes fixtures or reads private records.
import assert from "node:assert/strict";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
nextEnv.loadEnvConfig(process.cwd());
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, "wtgjwcoinwcivtjtdunn.supabase.co");
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  realtime: { transport: WebSocket },
});
for (const table of ["user_lists", "user_list_entries", "profiles"]) {
  const { error } = await client.from(table).select("id").limit(1);
  assert.equal(error?.code, "42501", `${table}: anonymous SELECT must be denied`);
  console.log(`PASS anonymous ${table} SELECT denied`);
}
for (const [table, columns] of [
  ["restaurants", "personal_notes,is_favorite"],
  ["restaurant_branches", "is_active,created_at,updated_at"],
]) {
  const { error } = await client.from(table).select(columns).limit(1);
  assert.equal(error?.code, "42501", `${table}: private/internal columns must be denied`);
}
for (const [table, columns] of [
  ["restaurants", "id,name,slug,category,short_description,price_level,website_url,instagram_url"],
  ["restaurant_branches", "id,restaurant_id,name,area,address,phone,google_maps_url,latitude,longitude"],
]) {
  const { error } = await client.from(table).select(columns).limit(1);
  assert.equal(error, null, `${table}: public projection remains available`);
}
console.log("PASS existing anonymous catalogue/branch permissions; no hosted writes or private data read");
