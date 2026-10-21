// Homepage data boundaries and interactions; no database writes required.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const modules = new Map();
const state = [];
let cursor = 0, navigation, fail = false;
const Card = () => null;
const mocks = {
  react: { ...require("react"), useState: initial => {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
  } },
  "next/link": { default: "a" },
  "next/server": { connection: async () => {} },
  "next/navigation": { useRouter: () => ({ push: url => { navigation = url; } }) },
  "@/components/restaurants/restaurant-card": { RestaurantCard: Card, PhotoFrame: () => null },
  "@/components/layout/preview-provider": { useLahoreDate: () => "2026-10-21" },
};
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", code)(id => {
    if (id in mocks) return mocks[id];
    if (id.startsWith("@/")) return load(path.resolve("src", id.slice(2) + ".ts"));
    return require(id);
  }, mod, mod.exports);
  modules.set(file, mod.exports); return mod.exports;
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
const { HomeExperience } = load(path.resolve("src/components/discovery/home-experience.tsx"));
const { places, enrichment } = load(path.resolve("src/data/prototype/restaurants.ts"));
const records = places.map(p => ({ id: "live-" + p.slug, slug: p.slug, name: "Live " + p.name, category: p.category,
  short_description: "Official " + p.slug, price_level: 2, website_url: "https://example.com", instagram_url: null }));
const render = restaurants => { cursor = 0; return nodes(HomeExperience({ restaurants })); };
const full = render(records);
const cards = full.filter(n => n.type === Card);
assert.ok(cards.length > 6);
for (const { props: { place, offer } } of cards) {
  const official = records.find(p => p.slug === place.slug);
  for (const key of Object.keys(official)) assert.equal(place[key], official[key]);
  assert.equal(place.demo, enrichment[place.slug]);
  if (offer) assert.equal(offer.restaurantSlug, place.slug);
}
assert.ok(full.some(n => n.props?.label === "All 74 places"));
const partial = render([{ id: "renamed", slug: "brewscape", name: "Renamed restaurant", category: "restaurant" }]);
assert.ok(partial.some(n => n.props?.label === "All 1 places"));
for (const n of partial.filter(n => n.type === Card)) assert.equal(n.props.place.name, "Renamed restaurant");
assert.ok(partial.filter(n => n.type === Card).every(n => n.props.offer));
assert.equal(render([]).filter(n => n.type === Card).length, 0);
assert.equal(render([{ id: "new", slug: "new-db-slug", name: "New cafe", category: "cafe" }]).filter(n => n.type === Card).length, 0);
let current = render(records);
current.find(n => n.type === "input" && n.props.type === "search").props.onChange({ target: { value: "Live Amu" } });
current.find(n => n.type === "select" && n.props.children?.[0]?.props?.children === "Anywhere in Lahore").props.onChange({ target: { value: "DHA" } });
current = render(records);
current.find(n => n.type === "form").props.onSubmit({ preventDefault() {} });
const query = new URL(navigation, "http://localhost").searchParams;
assert.equal(query.get("q"), "Live Amu"); assert.equal(query.get("area"), "DHA");
const wallet = current.find(n => n.type === "button" && n.props.className === "wallet-card ");
wallet.props.onClick();
current = render(records);
const tonight = current.find(n => n.props?.className === "button button-light");
const tonightQuery = new URL(tonight.props.href, "http://localhost").searchParams;
assert.equal(tonightQuery.get("today"), "true");
assert.equal(tonightQuery.get("sort"), "discount");
assert.ok(tonightQuery.get("card"));
mocks["@/components/discovery/home-experience"] = { HomeExperience };
mocks["@/lib/data/restaurants"] = { getRestaurants: async () => { if (fail) throw Error("Database unavailable"); return records; } };
const page = load(path.resolve("src/app/page.tsx")).default;
assert.equal((await page()).props.restaurants, records);
fail = true;
const error = nodes(await page());
assert.ok(error.some(n => n.props?.role === "alert"));
assert.ok(error.some(n => n.type === "a" && n.props.href === "/"));
assert.ok(error.every(n => n.type !== HomeExperience));
console.log("PASS homepage: live identity/enrichment, live-only offers, missing/empty/new slugs, category changes, actual counts, search/area submission, Tonight card links, and fetch-error retry without seed fallback.");
