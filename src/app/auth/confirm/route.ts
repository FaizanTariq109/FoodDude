import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/auth/origin";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const token_hash = params.get("token_hash");
  const type = params.get("type");
  const response = new NextResponse(
    "This confirmation link is invalid or has expired. Please request a new confirmation email.",
    { status: 400, headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "Content-Type": "text/plain; charset=utf-8",
    } },
  );
  if (!token_hash || token_hash.length > 2048 || /\s/.test(token_hash)
    || params.getAll("token_hash").length !== 1 || params.getAll("type").length !== 1
    || (type !== "email" && type !== "signup")) return response;

  let destination: URL;
  try {
    destination = new URL("/", getAppOrigin());
    // Bind auth writes to this response, including the SSR cache headers.
    const supabase = await createClient(response);
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) return response;
  } catch {
    // Never log provider errors: they may contain confirmation/session secrets.
    return response;
  }

  // Fixed local destination: discard all query parameters, including `next`.
  const redirect = NextResponse.redirect(destination, 303);
  response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma", "referrer-policy"]) {
    const value = response.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}
