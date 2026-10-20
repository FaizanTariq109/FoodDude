import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import WebSocket from "ws";
import { getSupabaseEnv } from "./env";

/** Create per request; never share a server client's cookies between requests. */
export async function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    // ws implements the socket API, but its Node event types differ from DOM types.
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies. This follows the SSR
          // adapter pattern, but session refresh is not implemented yet.
          // Add the full refresh flow before using authenticated rendering.
        }
      },
    },
  });
}
