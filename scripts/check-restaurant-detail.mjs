// Targeted detail-route checks; no database writes or credentials required.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
let response = { data: null, error: null };
const calls = [];
const query = Object.fromEntries(["from", "select", "eq", "abortSignal", "order"].map(key => [key, (...args) => {
  calls.push([key, ...args]); return query;
}]));
query.maybeSingle = async () => response;
query.then = (resolve, reject) => Promise.resolve(response).then(resolve, reject);
const mocks = {
  "server-only": {},
  "@/lib/supabase/server": { createClient: async () => ({ from: query.from }) },
  "next/server": { connection: async () => {} },
  "next/navigation": { notFound: () => { throw new Error("NOT_FOUND"); } },
  react: { ...require("react"), cache: fn => fn },
};
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", code)(id => {
    if (id in mocks) return mocks[id];
    if (id.startsWith("@/")) return load(path.resolve("src", id.slice(2) + ".ts"));
    return require(id);
  }, mod, mod.exports);
  modules.set(file, mod.exports); return mod.exports;
}
const data = load(path.resolve("src/lib/data/restaurants.ts"));
const canonical = { id: "live-id", slug: "fuoco", name: "Live renamed cafe", category: "cafe" };
response = { data: canonical, error: null };
assert.deepEqual(await data.getRestaurantBySlug("fuoco"), canonical);
assert.ok(calls.some(([key, value]) => key === "select" && value === "id, name, slug, category"));
assert.ok(calls.some(([key, column, value]) => key === "eq" && column === "slug" && value === "fuoco"));
response = { data: null, error: null };
assert.equal(await data.getRestaurantBySlug("missing"), null);
response = { data: null, error: { code: "42501" } };
await assert.rejects(data.getRestaurantBySlug("fuoco"), /Unable to load restaurant/);
response = { data: { ...canonical, category: "invalid" }, error: null };
await assert.rejects(data.getRestaurantBySlug("fuoco"), /Unexpected restaurant category/);
let missing = false, fail = false;
const rows = [canonical, { id: "new-id", slug: "brand-new-slug", name: "New cafe", category: "cafe" },
  { id: "live-brewscape", slug: "brewscape", name: "Live Brewscape", category: "cafe" }];
const Detail = () => null;
mocks["@/components/restaurants/restaurant-detail"] = { RestaurantDetail: Detail };
mocks["@/lib/data/restaurants"] = {
  getRestaurantBySlug: async slug => {
    if (fail) throw Error("Database unavailable");
    return missing ? null : rows.find(row => row.slug === slug) ?? null;
  },
  getRestaurants: async () => { if (fail) throw Error("Database unavailable"); return rows; },
};
const route = load(path.resolve("src/app/places/[slug]/page.tsx"));
const props = slug => ({ params: Promise.resolve({ slug }) });
assert.equal(route.generateStaticParams, undefined);
assert.equal((await route.generateMetadata(props("fuoco"))).title, canonical.name);
const page = await route.default(props("fuoco"));
assert.equal(page.type, Detail);
assert.equal(page.props.place.name, canonical.name);
assert.equal(page.props.place.category, "cafe");
assert.equal(page.props.place.demo.gallery.length, 3);
assert.deepEqual(page.props.source.map(p => p.id), rows.map(p => p.id));
assert.equal((await route.default(props("brand-new-slug"))).props.place.name, "New cafe");
missing = true;
await assert.rejects(route.default(props("missing")), /NOT_FOUND/);
await assert.rejects(route.generateMetadata(props("missing")), /NOT_FOUND/);
missing = false; fail = true;
await assert.rejects(route.default(props("fuoco")), /Database unavailable/);
await assert.rejects(route.generateMetadata(props("fuoco")), /Database unavailable/);
console.log("PASS detail data and route: permitted columns, slug lookup, missing/inaccessible rows, query errors, category validation, live metadata/identity, enrichment, live recommendation source, and new slugs.");
