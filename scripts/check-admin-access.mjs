// Offline route/SSR tests. No hosted accounts, tokens or database changes.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { AsyncLocalStorage } from "node:async_hooks";
import ts from "typescript";
globalThis.AsyncLocalStorage ??= AsyncLocalStorage;
const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const { unstable_doesMiddlewareMatch: matches } = require("next/experimental/testing/server");
let identity = "member", status = false, rpcCalls = 0;
let cookieAdapter;
const client = {
  auth: {
    async getClaims() {
      if (identity === "throw") throw Error("private identity details");
      if (cookieAdapter) cookieAdapter.setAll([{ name: "sb-test", value: "fake-refresh", options: { path: "/", httpOnly: true } }], { "Cache-Control": "private, no-store", Expires: "0" });
      return { data: identity === "anonymous" ? null : { claims: { sub: "verified-test-id", user_metadata: { role: "admin" } } }, error: identity === "invalid" ? Error("private jwt details") : null };
    },
    getSession() { throw Error("Unverified session must never authorize"); },
  },
  async rpc(...args) {
    rpcCalls++;
    assert.deepEqual(args, ["current_user_is_admin"], "no caller-supplied identity parameter");
    if (status === "throw") throw Error("private database details");
    return { data: status, error: status === "error" ? Error("private membership details") : null };
  },
};
const mocks = {
  "server-only": {},
  "@/lib/supabase/server": { createClient: async () => client },
  "next/link": { __esModule: true, default: "a" },
  "next/navigation": { redirect: destination => { throw Object.assign(Error("redirect"), { destination }); } },
  "@supabase/ssr": { createServerClient: (_url, _key, options) => { cookieAdapter = options.cookies; return client; } },
  "@/components/auth/sign-out": { SignOut: () => null },
  "@/components/ui/placeholder-page": { PlaceholderPage: () => null },
};
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", code)(id => {
    if (id in mocks) return mocks[id];
    if (id === "./env") return { getSupabaseEnv: () => ({ url: "https://example.invalid", publishableKey: "test-key" }) };
    if (id.startsWith("@/") || id.startsWith(".")) {
      const base = id.startsWith("@/") ? path.resolve("src", id.slice(2)) : path.resolve(path.dirname(file), id);
      return load(fs.existsSync(base + ".ts") ? base + ".ts" : base + ".tsx");
    }
    return require(id);
  }, mod, mod.exports);
  modules.set(file, mod.exports); return mod.exports;
}
const { proxy, config } = load(path.resolve("src/proxy.ts"));
const { requireAdmin } = load(path.resolve("src/lib/auth/require-admin.ts"));
const { AccountNavigation } = load(path.resolve("src/components/auth/account-navigation.tsx"));
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
for (const route of ["/admin", "/admin/login", "/admin/restaurants", "/admin/restaurants/test/edit", "/admin/nested.svg"]) {
  assert.equal(matches({ config, nextConfig: {}, url: route }), true);
  for (identity of ["anonymous", "invalid", "member", "throw"]) {
    for (status of [false, true, "error", "throw", null, "true", 1]) {
      const before = rpcCalls;
      const result = await proxy(new NextRequest("https://fooddude.test" + route, { headers: { RSC: "1", "x-role": "admin" } }));
      const anonymous = ["anonymous", "invalid"].includes(identity);
      const allowed = identity === "member" && status === true;
      const expected = anonymous ? 307 : allowed ? 200 : identity === "throw" || status !== false ? 503 : 403;
      assert.equal(result.status, expected);
      assert.equal(result.headers.get("location"), anonymous ? "https://fooddude.test/login" : null);
      assert.match(result.headers.get("cache-control"), /private.*no-store/);
      if (identity !== "throw") assert.equal(result.cookies.get("sb-test").value, "fake-refresh");
      if (anonymous || identity === "throw") assert.equal(rpcCalls, before);
      if (!allowed) {
        assert.equal(result.headers.get("x-middleware-next"), null);
        assert.doesNotMatch(await result.text(), /verified-test-id|private|membership|jwt/);
      }
    }
  }
}
console.log("PASS admin proxy: anonymous/invalid redirects, members denied, admins allowed, nested/RSC routes, spoofed roles ignored, fail-closed errors/malformed results, cookies/cache headers.");
cookieAdapter = null;
for (const file of ["src/app/admin/layout.tsx", "src/app/admin/page.tsx", "src/app/admin/login/page.tsx"]) {
  const render = load(path.resolve(file)).default;
  identity = "anonymous";
  await assert.rejects(render({ children: "protected" }), e => e.destination === "/login");
  identity = "member"; status = false;
  await assert.rejects(render({ children: "protected" }), /Access denied/);
  status = "error"; await assert.rejects(render({ children: "protected" }), /temporarily unavailable/);
  status = true;
  if (file.includes("/login/")) await assert.rejects(render({}), e => e.destination === "/admin");
  else assert.ok(await render({ children: "protected" }));
}
identity = "member"; status = true; await requireAdmin();
status = false; await assert.rejects(requireAdmin(), /Access denied/, "revocation is not cached");
for (identity of ["anonymous", "member"]) for (status of [true, false, "error", "throw"]) {
  const links = nodes(await AccountNavigation()).filter(n => n.type === "a").map(n => n.props.href);
  assert.equal(links.includes("/admin"), identity === "member" && status === true);
}
console.log("PASS server page/layout guards, revocation, legacy nested login route, administrator-only navigation.");
for (identity of ["anonymous", "member", "throw"]) for (const route of ["/", "/places", "/discover", "/places/test", "/administrator"]) {
  const before = rpcCalls;
  const result = await proxy(new NextRequest("https://fooddude.test" + route));
  assert.equal(result.headers.get("x-middleware-next"), "1");
  assert.equal(result.headers.get("location"), null);
  assert.equal(rpcCalls, before);
}
console.log("PASS existing public catalogue remains accessible, including during authorization outages.");
