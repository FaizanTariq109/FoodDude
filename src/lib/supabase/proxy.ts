import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import WebSocket from "ws";
import { getSupabaseEnv } from "./env";

export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseEnv();
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  const supabase = createServerClient(url, publishableKey, {
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        const previous = response;
        response = NextResponse.next({ request });
        // Retain earlier batches while forwarding the latest request cookies.
        previous.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
        for (const header of ["cache-control", "expires", "pragma"]) {
          const value = previous.headers.get(header);
          if (value) response.headers.set(header, value);
        }
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });
  try {
    await supabase.auth.getClaims();
  } catch {
    // Public routes remain available on Auth outages. No identity or access is
    // granted here; future authorization must independently verify claims.
  }
  return response;
}
