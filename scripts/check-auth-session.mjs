// Offline cookie/response boundary tests with real NextRequest/NextResponse.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { AsyncLocalStorage } from "node:async_hooks";
// Next initializes this global in its server bootstrap; reproduce it offline.
globalThis.AsyncLocalStorage ??= AsyncLocalStorage;
const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
// This installed Next 16 build still exports the earlier testing-helper name.
const { unstable_doesMiddlewareMatch: doesProxyMatch } = require("next/experimental/testing/server");
const modules = new Map();
let claimsMode = "anonymous", otpMode = "success", claimsCalls = 0, otpCalls = 0, clientCalls = 0;
let lastCookies, lastOtp;
const storedCookies = new Map();
let readOnly = false;
const refreshHeaders = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0", Pragma: "no-cache",
};
const cookie = (name, value, maxAge = 3600) => ({ name, value, options: { path: "/", sameSite: "lax", secure: true, maxAge } });
const mocks = {
  "@/lib/auth/origin": { getAppOrigin: () => "https://fooddude.test" },
  "server-only": {},
  "next/headers": { cookies: async () => ({
    getAll: () => [...storedCookies].map(([name, value]) => ({ name, value })),
    set: (name, value) => { if (readOnly) throw Error("Server Component"); storedCookies.set(name, value); },
  }) },
  "@supabase/ssr": { createServerClient: (_url, _key, { cookies }) => {
    clientCalls++; lastCookies = cookies;
    return { auth: {
      getClaims: async () => {
        claimsCalls++; cookies.getAll();
        if (claimsMode === "refresh") {
          cookies.setAll([cookie("sb-test-auth-token.0", "refreshed-a"), cookie("sb-test-auth-token.2", "", 0)], refreshHeaders);
          assert.ok(cookies.getAll().some(c => c.value === "refreshed-a"));
          cookies.setAll([cookie("sb-test-auth-token.1", "refreshed-b")], refreshHeaders);
        }
        if (claimsMode === "throw") throw Error("private provider details");
        return { data: claimsMode === "anonymous" ? null : { claims: { sub: "verified-id" } }, error: claimsMode === "invalid" ? Error("bad jwt") : null };
      },
      getSession: () => { throw Error("Unverified getSession must never be used"); },
      verifyOtp: async params => {
        otpCalls++; lastOtp = params;
        if (otpMode === "throw") throw Error("secret provider response");
        if (otpMode !== "success") return { error: Error(otpMode + " private details") };
        cookies.setAll([cookie("sb-test-auth-token.0", "confirmed-a"), cookie("sb-test-auth-token.1", "confirmed-b")], refreshHeaders);
        return { data: { session: {} }, error: null };
      },
    } };
  } },
};
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", code)(id => {
    if (id in mocks) return mocks[id];
    if (id === "./env") return { getSupabaseEnv: () => ({ url: "https://example.invalid", publishableKey: "test-public-key" }) };
    if (id.startsWith("@/")) return load(path.resolve("src", id.slice(2) + ".ts"));
    return require(id);
  }, mod, mod.exports);
  modules.set(file, mod.exports); return mod.exports;
}
const { proxy, config } = load(path.resolve("src/proxy.ts"));
for (const url of ["/", "/places", "/places/fuoco", "/discover", "/offers", "/auth/confirm?type=email"]) {
  assert.equal(doesProxyMatch({ config, nextConfig: {}, url }), true);
  const result = await proxy(new NextRequest("https://fooddude.test" + url));
  assert.equal(result.headers.get("x-middleware-next"), "1");
  assert.equal(result.headers.get("location"), null);
  assert.match(result.headers.get("cache-control"), /private.*no-store/);
}
for (const url of ["/_next/static/chunk.js", "/_next/image?url=foo", "/favicon.ico", "/images/prototype/pizza.jpg", "/fonts/test.woff2"]) {
  assert.equal(doesProxyMatch({ config, nextConfig: {}, url }), false);
}
claimsMode = "refresh";
const request = new NextRequest("https://fooddude.test/places", { headers: { cookie: "sb-test-auth-token.2=stale; theme=dark" } });
const refreshed = await proxy(request);
assert.equal(request.cookies.get("sb-test-auth-token.0").value, "refreshed-a");
assert.match(refreshed.headers.get("x-middleware-request-cookie"), /refreshed-a/);
assert.match(refreshed.headers.get("x-middleware-request-cookie"), /theme=dark/);
assert.equal(refreshed.cookies.get("sb-test-auth-token.0").value, "refreshed-a");
assert.equal(refreshed.cookies.get("sb-test-auth-token.1").value, "refreshed-b");
assert.equal(refreshed.cookies.get("sb-test-auth-token.2").maxAge, 0);
assert.equal(refreshed.cookies.get("sb-test-auth-token.0").secure, true);
for (const [header, value] of Object.entries(refreshHeaders)) assert.equal(refreshed.headers.get(header), value);
for (claimsMode of ["invalid", "throw", "anonymous"]) {
  const result = await proxy(new NextRequest("https://fooddude.test/"));
  assert.equal(result.headers.get("location"), null);
  assert.equal(result.headers.get("x-middleware-next"), "1");
  assert.equal(result.cookies.getAll().length, 0, "no cross-request cookie leakage");
}
assert.equal(claimsCalls, clientCalls);
console.log("PASS proxy: getClaims, anonymous access, invalid sessions/outages, matcher, request/response chunked cookies, deletions, cache headers, per-request isolation.");

const { GET } = load(path.resolve("src/app/auth/confirm/route.ts"));
const confirm = query => GET(new NextRequest("https://fooddude.test/auth/confirm?" + query));
for (const query of ["", "type=email", "token_hash=test", "token_hash=test&type=recovery", "token_hash=test&type=magiclink", "token_hash=a&type=email&type=signup", "token_hash=a&token_hash=b&type=email", "token_hash=%20&type=email"]) {
  const before = otpCalls;
  const result = await confirm(query);
  assert.equal(result.status, 400); assert.equal(otpCalls, before);
  assert.equal(result.headers.get("location"), null);
}
for (otpMode of ["expired", "invalid", "throw"]) {
  const result = await confirm("token_hash=sensitive-token&type=email&next=https://evil.test");
  assert.equal(result.status, 400);
  assert.equal(result.headers.get("location"), null);
  assert.doesNotMatch(await result.text(), /sensitive-token|private details|provider|evil/);
  assert.match(result.headers.get("cache-control"), /no-store/);
  assert.equal(result.headers.get("referrer-policy"), "no-referrer");
}
otpMode = "success";
const hostileHost = await GET(new NextRequest("https://attacker.test/auth/confirm?token_hash=sensitive-token&type=email"));
assert.equal(hostileHost.headers.get("location"), "https://fooddude.test/");
for (const type of ["email", "signup"]) for (const next of ["https://evil.test", "//evil.test", "/\\evil.test", "/discover?token_hash=secret"]) {
  const result = await confirm(`token_hash=sensitive-token&type=${type}&next=${encodeURIComponent(next)}&extra=sensitive-token`);
  assert.equal(result.status, 303);
  assert.equal(result.headers.get("location"), "https://fooddude.test/");
  assert.deepEqual(lastOtp, { token_hash: "sensitive-token", type });
  assert.equal(result.cookies.get("sb-test-auth-token.0").value, "confirmed-a");
  assert.equal(result.cookies.get("sb-test-auth-token.1").value, "confirmed-b");
  for (const [header, value] of Object.entries(refreshHeaders)) assert.equal(result.headers.get(header), value);
  assert.equal(result.headers.get("referrer-policy"), "no-referrer");
}
console.log("PASS confirmation: missing/unsupported/duplicate tokens, expired/invalid tokens, provider errors, verifyOtp cookie/header propagation, fixed redirects without secrets.");

const { createClient } = load(path.resolve("src/lib/supabase/server.ts"));
await createClient(); lastCookies.setAll([cookie("test", "writable")], refreshHeaders);
assert.equal(storedCookies.get("test"), "writable");
readOnly = true; await createClient();
assert.doesNotThrow(() => lastCookies.setAll([cookie("test", "readonly")], refreshHeaders));
const nextConfig = load(path.resolve("next.config.ts")).default;
assert.ok(nextConfig.logging.incomingRequests.ignore.some(regex => regex.test("/auth/confirm?token_hash=secret")));
for (const file of ["src/proxy.ts", "src/lib/supabase/proxy.ts", "src/app/auth/confirm/route.ts"]) {
  assert.doesNotMatch(fs.readFileSync(file, "utf8"), /console\.|getSession\(/);
}
console.log("PASS existing server client writable/read-only behavior and confirmation request-log suppression. No live Auth requests or account changes.");
