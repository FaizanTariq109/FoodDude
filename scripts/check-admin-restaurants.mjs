// Offline SSR and data-boundary checks, with user-scoped Supabase mocked.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
let interactive = false, state = [], cursor = 0;
const react = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const base = { id: "fixture", short_description: null, price_level: null, website_url: null,
  instagram_url: null, created_at: "2026-10-21T00:00:00Z", updated_at: "2026-10-21T00:00:00Z" };
let records = [
  { ...base, id: "1", name: "Alpha Kitchen", slug: "alpha", category: "restaurant", is_active: true },
  { ...base, id: "2", name: "Alpha Cafe", slug: "alpha-cafe", category: "cafe", is_active: false,
    short_description: "Official description", website_url: "https://example.com", personal_notes: "PRIVATE LEGACY NOTE", is_favorite: true },
  { ...base, id: "3", name: "Beta Cafe", slug: "beta", category: "cafe", is_active: true },
];
const fixtureRecords = records;
let access = true, failure = false, calls = [], ranges = [], badData = false;
const client = {
  auth: { getClaims: async () => ({ data: access === "anonymous" ? null : { claims: { sub: "test" } }, error: null }) },
  rpc(name, ...args) {
    calls.push(name); assert.deepEqual(args, []);
    if (name === "current_user_is_admin") return Promise.resolve({ data: access, error: access === "error" ? Error("SECRET AUTH ERROR") : null });
    assert.equal(name, "admin_restaurants");
    let start, end;
    const chain = {
      order(column) { assert.equal(column, "slug"); return chain; },
      range(a, b) { start = a; end = b; ranges.push([a,b]); return chain; },
      abortSignal() { return Promise.resolve({ data: badData ? null : records.slice(start, end+1), error: failure ? Error("SECRET DB ERROR") : null }); },
    };
    return chain;
  },
};
const mocks = {
  react: { ...react, useState: initial => {
    if (!interactive) return react.useState(initial);
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
  } },
  "server-only": {},
  "@/lib/supabase/server": { createClient: async () => client },
  "next/link": { __esModule: true, default: "a" },
  "next/navigation": { redirect: destination => { throw Object.assign(Error("redirect"), { destination }); } },
};
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  new Function("require", "module", "exports", code)(id => {
    if (id in mocks) return mocks[id];
    if (id.startsWith("@/") || id.startsWith(".")) {
      const basePath = id.startsWith("@/") ? path.resolve("src", id.slice(2)) : path.resolve(path.dirname(file), id);
      return load(fs.existsSync(basePath+".ts") ? basePath+".ts" : basePath+".tsx");
    }
    return require(id);
  }, mod, mod.exports);
  modules.set(file, mod.exports); return mod.exports;
}
const { getAdminRestaurants } = load(path.resolve("src/lib/data/admin-restaurants.ts"));
const { filterRestaurants, restaurantFilters, restaurantCounts, officialUrl } = load(path.resolve("src/lib/admin/restaurants.ts"));
const page = load(path.resolve("src/app/admin/restaurants/page.tsx")).default;
const dashboard = load(path.resolve("src/app/admin/page.tsx")).default;
const render = async params => renderToStaticMarkup(await page({ searchParams: Promise.resolve(params) }));
assert.deepEqual(restaurantCounts(records), { total: 3, restaurants: 1, cafes: 2, active: 2, inactive: 1 });
for (const [params, expected] of [
  [{}, 3], [{ q: "  ALPHA  " }, 2], [{ category: "cafe" }, 2], [{ status: "inactive" }, 1],
  [{ q: "alpha", category: "cafe", status: "inactive" }, 1], [{ q: "%" }, 0],
  [{ q: "alpha", category: "restaurant", status: "inactive" }, 0],
  [{ category: "invalid", status: ["active"], q: ["alpha"] }, 3],
]) assert.equal(filterRestaurants(records, restaurantFilters(params)).length, expected);
assert.equal(officialUrl("javascript:alert(1)"), null);
assert.equal(officialUrl("https://user:pass@example.com"), null);
assert.equal(officialUrl("https://example.com"), "https://example.com/");
const loaded = await getAdminRestaurants();
assert.equal(loaded.length, 3);
assert.ok(!("personal_notes" in loaded[1]) && !("is_favorite" in loaded[1]));
let html = await render({ q: "alpha", category: "cafe", status: "inactive" });
assert.match(html, /Alpha Cafe/); assert.doesNotMatch(html, /Alpha Kitchen|Beta Cafe|PRIVATE LEGACY NOTE/);
assert.match(html, /Official description/); assert.match(html, /href="https:\/\/example.com\//);
assert.match(html, /Showing 1 of 3/); assert.match(html, /Inactive/);
assert.match(html, /aria-label="Restaurant filters"/); assert.match(html, /name="category"/); assert.match(html, /name="status"/);
assert.match(await render({ q: "nonexistent" }), /No matching places/);
records = []; assert.match(await render({}), /The catalogue is empty/); records = fixtureRecords;
html = renderToStaticMarkup(await dashboard());
assert.match(html, /Total restaurants &amp; cafes/); assert.match(html, /href="\/admin\/restaurants"/);
console.log("PASS admin SSR: real data boundary, counts, combined search/filters, metadata, empty states, legacy field exclusion, safe links");
// Exercise the actual component handlers and persistent hook state across renders.
const { RestaurantCatalogue } = load(path.resolve("src/components/admin/restaurant-catalogue.tsx"));
interactive = true;
const rpcBefore = calls.length;
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
let tree;
function rerender() {
  cursor = 0;
  tree = RestaurantCatalogue({ rows: loaded, initialFilters: restaurantFilters({}) });
  return renderToStaticMarkup(tree);
}
function find(type, predicate = () => true) {
  const node = nodes(tree).find(node => node.type === type && predicate(node.props));
  assert.ok(node, `missing ${type}`); return node.props;
}
function count(expected) { assert.match(rerender(), new RegExp(`Showing ${expected} of 3 places`)); }
function search(value) { find("input").onChange({ target: { value } }); }
function select(name, value) { find("select", props => props.name === name).onChange({ target: { value } }); rerender(); }
function click(label) { find("button", props => props.children === label).onClick(); }
function apply() { let prevented = false; find("form").onSubmit({ preventDefault() { prevented = true; } }); assert.ok(prevented); }
count(3);
assert.ok(rerender().indexOf('name="status"') < rerender().indexOf('Search restaurants'));
assert.equal(find("button", props => props.children === "Clear search").disabled, true);
select("category", "cafe"); select("status", "inactive"); count(3);
search("   ALPHA   "); count(2); // Draft filters must not affect instant search.
apply(); count(1);
assert.match(rerender(), /Alpha Cafe/); assert.doesNotMatch(rerender(), /Alpha Kitchen|Beta Cafe/);
search("beta"); count(0);
click("Clear search"); count(1); // Applied cafe/inactive remains.
search("alpha"); count(1);
click("Clear filters"); count(2); // Search remains, both applied/draft filters reset.
assert.equal(find("input").value, "alpha");
assert.equal(find("select", props => props.name === "category").value, "all");
assert.equal(find("select", props => props.name === "status").value, "all");
click("Clear search"); count(3);
select("status", "active"); count(3); apply(); count(2);
search("cAfE"); count(1);
select("category", "restaurant"); count(1); // Pending change stays unapplied.
click("Clear search"); count(2);
apply(); count(1);
assert.equal(find("input").id, "restaurant-search");
assert.equal(find("p", props => props.role === "status")["aria-live"], "polite");
assert.equal(calls.length, rpcBefore, "all interactions use loaded records without RPC calls");
interactive = false; state = [];
console.log("PASS instant search, case/whitespace matching, draft versus applied filters, independent clearing, live counts, keyboard form submission, no interaction RPCs");
for (access of [false, "anonymous", "error", null, "true"]) {
  for (const action of [getAdminRestaurants, () => render({}), dashboard]) {
    calls = [];
    await assert.rejects(action());
    assert.ok(!calls.includes("admin_restaurants"), "guard blocks privileged fetch");
  }
}
access = true; failure = true;
for (const action of [() => render({}), async () => renderToStaticMarkup(await dashboard())]) {
  html = await action(); assert.match(html, /role="alert"/); assert.match(html, /Try again/);
  assert.doesNotMatch(html, /Alpha|SECRET|Showing 0/);
}
await assert.rejects(getAdminRestaurants()); failure = false;
badData = true; await assert.rejects(getAdminRestaurants()); badData = false;
console.log("PASS SSR and data guards deny non-admin/anonymous/errors; database failures never render partial or fallback data");
records = Array.from({ length: 201 }, (_, i) => ({ ...fixtureRecords[0], id: String(i) }));
ranges = []; assert.equal((await getAdminRestaurants()).length, 201);
assert.deepEqual(ranges, [[0,99],[100,199],[200,299]]);
console.log("PASS catalogue pagination continues past API page size without losing records");
