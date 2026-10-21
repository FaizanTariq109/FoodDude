import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import WebSocket from "ws";
import { getSupabaseEnv } from "./env";
import { getAdminAccess } from "@/lib/auth/admin";

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
  // Cover direct requests, client navigations and RSC requests for every child.
  // Page/data guards remain necessary: proxy visibility is not data authorization.
  const pathname = request.nextUrl.pathname;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const access = await getAdminAccess(supabase);
    if (access !== "admin") {
      const blocked = access === "anonymous"
        ? NextResponse.redirect(new URL("/login", request.url))
        : new NextResponse(access === "denied" ? "Access denied." : "Administrator access is temporarily unavailable. Please try again later.", {
          status: access === "denied" ? 403 : 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      // Preserve refresh/deletion cookies without copying middleware-next headers.
      response.cookies.getAll().forEach(cookie => blocked.cookies.set(cookie));
      for (const header of ["cache-control", "expires", "pragma"]) {
        const value = response.headers.get(header);
        if (value) blocked.headers.set(header, value);
      }
      blocked.headers.set("Cache-Control", "private, no-store");
      return blocked;
    }
    return response;
  }
  try {
    await supabase.auth.getClaims();
  } catch {
    // Public routes remain available on Auth outages. No identity or access is
    // granted here; future authorization must independently verify claims.
  }
  return response;
}
