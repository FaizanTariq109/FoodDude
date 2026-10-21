// Offline SSR of real public components. Only synthetic metadata is used.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url), react = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const mocks = {
  "server-only": {},
  "next/server": { connection: async () => {} },
  "next/link": { __esModule: true, default: "a" },
  "next/image": { __esModule: true, default: ({ src, alt }) => react.createElement("img", {src,alt}) },
  "@/components/layout/preview-provider": { usePreview: () => ({ favorites: [], toggleFavorite() {} }) },
  "@/components/ui/modal": { Modal: () => null },
  "@/components/offers/offer-card": { OfferCard: () => null },
};
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const mod = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync(file,"utf8"), {compilerOptions:{
    module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, jsx:ts.JsxEmit.ReactJSX, esModuleInterop:true,
  }}).outputText;
  new Function("require","module","exports",code)(id => {
    if (id in mocks) return mocks[id];
    if (id.startsWith("@/") || id.startsWith(".")) {
      const base = id.startsWith("@/") ? path.resolve("src",id.slice(2)) : path.resolve(path.dirname(file),id);
      return load(fs.existsSync(base+".ts") ? base+".ts" : base+".tsx");
    }
    return require(id);
  },mod,mod.exports);
  modules.set(file,mod.exports); return mod.exports;
}
const { enrichRestaurants } = load(path.resolve("src/data/prototype/restaurants.ts"));
const { RestaurantCard } = load(path.resolve("src/components/restaurants/restaurant-card.tsx"));
const { RestaurantDetail } = load(path.resolve("src/components/restaurants/restaurant-detail.tsx"));
const { officialRestaurantUrl, priceLevelLabel } = load(path.resolve("src/lib/restaurants/official.ts"));
const { filterPlaces, defaultFilters } = load(path.resolve("src/lib/discovery.ts"));
const official = {id:"fixture", name:"Official Cafe", slug:"fuoco", category:"cafe", short_description:"Administrator maintained description.",
  price_level:3, website_url:"https://example.com/menu", instagram_url:"https://instagram.com/example"};
const renderCard = (place,personal=false) => renderToStaticMarkup(react.createElement(RestaurantCard,{place,personal,offer:null}));
const renderDetail = place => renderToStaticMarkup(react.createElement(RestaurantDetail,{place,source:[place]}));
const place = enrichRestaurants([official])[0];
place.demo = {...place.demo, description:"INVENTED DESCRIPTION MUST NOT APPEAR"};
for (const html of [renderCard(place),renderCard(place,true),renderDetail(place)]) {
  assert.match(html,/Administrator maintained description\./); assert.match(html,/Price level: 3 \/ 4/);
  assert.match(html,/Official Cafe/); assert.doesNotMatch(html,/INVENTED DESCRIPTION|An unhurried meal/);
}
let html = renderDetail(place);
assert.ok(html.indexOf('class="official-restaurant"') < html.indexOf('class="detail-gallery'));
assert.match(html,/href="https:\/\/example.com\/menu"/); assert.match(html,/Official website/);
assert.match(html,/href="https:\/\/instagram.com\/example"/); assert.match(html,/Official Instagram/);
assert.match(html,/opens in a new tab/); assert.match(html,/rel="noopener noreferrer"/);
assert.match(html,/Illustrative photography/); assert.match(html,/DEMO/);
for (const missing of [place, {...place,slug:"new-place",demo:undefined}]) {
  const empty = {...missing, short_description:null,price_level:null,website_url:null,instagram_url:null};
  assert.match(renderCard(empty),/No official description added yet/);
  assert.match(renderDetail(empty),/No official description has been added yet/);
  assert.match(renderDetail(empty),/No official links have been added yet/);
  assert.doesNotMatch(renderCard(empty),/Price level:/);
  assert.doesNotMatch(renderDetail(empty),/INVENTED DESCRIPTION|An unhurried meal/);
}
for (const value of [null,"","javascript:alert(1)","data:text/html,evil","//example.com","https://u:p@example.com","https://example.com\\evil","https:\n//example.com"]) assert.equal(officialRestaurantUrl(value),null);
assert.equal(officialRestaurantUrl("https://example.com"),"https://example.com/");
for (const value of [null,0,5,2.5]) assert.equal(priceLevelLabel(value),null);
html = renderDetail({...place, website_url:"javascript:alert(1)",instagram_url:"https://u:p@example.com",short_description:"<script>alert(1)</script>"});
assert.doesNotMatch(html,/href="javascript:|https:\/\/u:p|<script>/); assert.match(html,/&lt;script&gt;/);
const changed = enrichRestaurants([{...official,short_description:"Fresh request value",price_level:1}])[0];
assert.match(renderCard(changed),/Fresh request value/); assert.match(renderDetail(changed),/Fresh request value/);
assert.doesNotMatch(renderDetail(changed),/Administrator maintained description/);
assert.deepEqual(filterPlaces({...defaultFilters,q:"official",category:"cafe"},null,[],[changed]).map(p=>p.id),[official.id]);
assert.deepEqual(filterPlaces({...defaultFilters,category:"restaurant"},null,[],[changed]),[]);
console.log("PASS real card/detail SSR: official metadata, personal cards, neutral missing states, safe labelled links, price bounds, demo separation, escaping, refreshed values and existing filters");
let current = official;
const Explorer = () => null;
mocks["@/lib/data/restaurants"] = { getRestaurants: async () => [current] };
mocks["@/components/discovery/explorer"] = { Explorer };
for (const file of ["src/app/discover/page.tsx","src/app/places/page.tsx"]) {
  const route = load(path.resolve(file)).default;
  const renderPage = () => route().props.children.type();
  assert.equal((await renderPage()).props.source[0].short_description,official.short_description);
  current = {...official,short_description:"Updated for next request"};
  assert.equal((await renderPage()).props.source[0].short_description,current.short_description);
  current = official;
}
console.log("PASS Discover/My Places server boundaries retain official metadata and pick up changed values on a new request");
