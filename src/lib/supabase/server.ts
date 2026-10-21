import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import WebSocket from "ws";
import { getSupabaseEnv } from "./env";

/** Create per request; never share a server client's cookies between requests. */
export async function createClient(response?: NextResponse) {
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    // ws implements the socket API, but its Node event types differ from DOM types.
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        if (response) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
          return;
        }
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies. The proxy refreshes the
          // session and forwards its cookies and cache headers on the response.
        }
      },
    },
  });
}
