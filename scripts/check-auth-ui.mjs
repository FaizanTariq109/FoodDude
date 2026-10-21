// Real Supabase SSR cookie handling against an in-memory fake Auth transport.
// No hosted accounts, emails, database writes or external requests.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { webcrypto } from "node:crypto";
import ts from "typescript";
globalThis.crypto ??= webcrypto;
const require = createRequire(import.meta.url);
const { createServerClient } = require("@supabase/ssr");
const modules = new Map(), jar = new Map(), writes = [], calls = [], invalidations = [];
let mode = "success", clientFailure = false, uiState = {}, pending = false;
const user = { id: "00000000-0000-4000-8000-000000000001", email: "member@example.invalid", aud: "authenticated", role: "authenticated", app_metadata: { provider: "email" }, user_metadata: {}, created_at: new Date().toISOString() };
const jwt = [
  { alg: "HS256", typ: "JWT" },
  { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), aud: "authenticated" },
].map(v => Buffer.from(JSON.stringify(v)).toString("base64url")).join(".") + ".ZmFrZS1zaWduYXR1cmU";
const transport = async (input, options) => {
  const url = new URL(input);
  assert.equal(url.origin, "https://auth.example.invalid");
  const body = options.body ? JSON.parse(options.body) : null;
  calls.push({ path: url.pathname, query: url.searchParams, body });
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "x-supabase-api-version": "2024-01-01" } });
  if (url.pathname.endsWith("/signup")) {
    if (mode !== "success") return json({ code: mode, msg: "private provider detail" }, 422);
    return json({ user, session: null });
  }
  if (url.pathname.endsWith("/token")) {
    if (mode !== "success") return json({ code: mode, msg: "private provider detail" }, 400);
    return json({ access_token: jwt, refresh_token: "fake-refresh-token", expires_in: 3600, token_type: "bearer", user });
  }
  if (url.pathname.endsWith("/user")) return mode === "invalid_claims" ? json({ code: "bad_jwt", msg: "invalid" }, 401) : json(user);
  if (url.pathname.endsWith("/logout")) return mode === "logout_failure" ? json({ msg: "private provider detail" }, 500) : json({});
  throw Error("Unexpected Auth endpoint");
};
const mocks = {
  "server-only": {},
  "next/link": { __esModule: true, default: "a" },
  react: { ...require("react"), useActionState: action => [uiState, action, pending] },
  "next/navigation": { redirect: destination => { const error = Error("redirect"); error.destination = destination; throw error; } },
  "next/cache": { revalidatePath: (...args) => invalidations.push(args) },
  "next/headers": { cookies: async () => ({
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (name, value, options) => { writes.push({ name, value, options }); if (options?.maxAge === 0) jar.delete(name); else jar.set(name, value); },
  }) },
  "@supabase/ssr": { createServerClient: (url, key, options) => {
    if (clientFailure) throw Error("private setup detail");
    return createServerClient(url, key, { ...options, global: { fetch: transport } });
  } },
};
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", code)(id => {
    if (id in mocks) return mocks[id];
    if (id === "./env") return { getSupabaseEnv: () => ({ url: "https://auth.example.invalid", publishableKey: "test-public-key" }) };
    if (id.startsWith("@/")) {
      const base = path.resolve("src", id.slice(2));
      return load(fs.existsSync(base + ".ts") ? base + ".ts" : base + ".tsx");
    }
    if (id.startsWith(".")) {
      const base = path.resolve(path.dirname(file), id);
      return load(fs.existsSync(base + ".ts") ? base + ".ts" : base + ".tsx");
    }
    return require(id);
  }, mod, mod.exports);
  modules.set(file, mod.exports); return mod.exports;
}
const { getAppOrigin } = load(path.resolve("src/lib/auth/origin.ts"));
const oldOrigin = process.env.APP_ORIGIN, oldMode = process.env.NODE_ENV;
const form = (values = {}) => {
  const data = new FormData();
  Object.entries({ email: "member@example.invalid", password: "long password", confirmPassword: "long password", ...values }).forEach(([k, v]) => data.set(k, v));
  return data;
};
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
try {
  process.env.NODE_ENV = "production";
  for (const value of ["", "http://localhost:3000", "https://trusted.test/auth/confirm", "https://trusted.test?next=x", "https://trusted.test#x", "https://user:pass@trusted.test", "javascript:alert(1)", "//evil.test"]) {
    process.env.APP_ORIGIN = value; assert.throws(getAppOrigin);
  }
  process.env.APP_ORIGIN = "https://fooddude.test/";
  assert.equal(getAppOrigin(), "https://fooddude.test");
  process.env.NODE_ENV = "development"; delete process.env.APP_ORIGIN;
  assert.equal(getAppOrigin(), "http://localhost:3000");
  process.env.APP_ORIGIN = "http://localhost:3100"; assert.equal(getAppOrigin(), "http://localhost:3100");
  process.env.NODE_ENV = "production"; process.env.APP_ORIGIN = "https://fooddude.test";
  const { signup, login, logout } = load(path.resolve("src/app/auth/actions.ts"));
  for (const [values, field] of [[{ email: "bad" }, "email"], [{ password: "short" }, "password"], [{ confirmPassword: "different" }, "confirmPassword"]]) {
    const count = calls.length;
    assert.ok((await signup({}, form(values))).errors[field]); assert.equal(calls.length, count);
  }
  assert.ok((await login({}, form({ password: "" }))).errors.password);
  const success = await signup({}, form({ emailRedirectTo: "https://evil.test/auth/confirm", next: "https://evil.test" }));
  assert.deepEqual(success, { checkEmail: true });
  const signupCall = calls.find(c => c.path.endsWith("/signup"));
  assert.equal(signupCall.query.get("redirect_to"), "https://fooddude.test");
  assert.ok(!JSON.stringify(signupCall.body).includes("admin"));
  for (mode of ["user_already_exists", "email_exists"]) assert.deepEqual(await signup({}, form()), success);
  mode = "weak_password"; assert.match((await signup({}, form())).message, /try again later/);
  mode = "invalid_credentials"; assert.match((await login({}, form())).message, /email and password/);
  mode = "email_not_confirmed"; assert.match((await login({}, form())).message, /confirm your email/);
  clientFailure = true; assert.match((await login({}, form())).message, /temporarily unavailable/); clientFailure = false;
  mode = "success";
  await assert.rejects(login({}, form()), error => error.destination === "/places");
  assert.ok(writes.some(c => c.name.includes("auth-token") && c.value));
  assert.ok(invalidations.some(([p, type]) => p === "/" && type === "layout"));
  const { createClient } = load(path.resolve("src/lib/supabase/server.ts"));
  const secondRequest = await createClient();
  const { data, error } = await secondRequest.auth.getClaims();
  assert.equal(error, null); assert.equal(data.claims.sub, user.id);
  const { AccountNavigation } = load(path.resolve("src/components/auth/account-navigation.tsx"));
  assert.ok(nodes(await AccountNavigation()).some(n => n.type?.name === "SignOut"));
  mode = "logout_failure"; assert.match((await logout({})).message, /try again/);
  assert.ok([...jar.keys()].some(k => k.includes("auth-token")));
  mode = "success";
  await assert.rejects(logout({}), error => error.destination === "/");
  assert.equal([...jar.keys()].filter(k => k.includes("auth-token")).length, 0);
  assert.ok(writes.some(c => c.name.includes("auth-token") && c.options.maxAge === 0));
  const loggedOutClient = await createClient();
  assert.equal((await loggedOutClient.auth.getClaims()).data, null);
  const links = nodes(await AccountNavigation()).filter(n => n.type === "a").map(n => n.props.href);
  assert.deepEqual(links, ["/login", "/signup"]);
  clientFailure = true; assert.deepEqual(nodes(await AccountNavigation()).filter(n => n.type === "a").map(n => n.props.href), links); clientFailure = false;
  const { AuthForm } = load(path.resolve("src/components/auth/auth-form.tsx"));
  let tree = nodes(AuthForm({ mode: "signup" }));
  assert.equal(tree.filter(n => n.type === "input").length, 3);
  assert.equal(tree.find(n => n.props?.name === "password").props.minLength, 8);
  assert.ok(tree.filter(n => n.type === "input").every(n => n.props.required && n.props.id && n.props.autoComplete));
  uiState = { errors: { confirmPassword: "Your passwords must match." } };
  tree = nodes(AuthForm({ mode: "signup" }));
  assert.equal(tree.find(n => n.props?.name === "confirmPassword").props["aria-invalid"], true);
  uiState = success; assert.ok(nodes(AuthForm({ mode: "signup" })).some(n => n.props?.role === "status"));
  uiState = {}; pending = true;
  assert.equal(nodes(AuthForm({ mode: "login" })).find(n => n.type === "button").props.disabled, true);
  const { SignOut } = load(path.resolve("src/components/auth/sign-out.tsx"));
  assert.equal(SignOut().type, "form");
  console.log("PASS auth UI: signup/login validation, generic duplicate-account state, trusted base origin, provider errors, real SSR cookie persistence, verified navigation, POST action logout/deletions, accessible confirmation/errors/pending states. No hosted users created.");
} finally {
  if (oldOrigin === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = oldOrigin;
  if (oldMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldMode;
}
