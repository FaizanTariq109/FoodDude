import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url), modules = new Map();
const react = require("react"), { renderToStaticMarkup } = require("react-dom/server");
let access = true, authError = false, rpcError = null, calls = [], paths = [], uiState = {}, pending = false;
const id = "00000000-0000-4000-8000-000000000001";
const mocks = {
  "server-only": {}, "next/link": { __esModule: true, default: "a" },
  "next/cache": { revalidatePath: (...args) => paths.push(args) },
  react: { ...react, useActionState: () => [uiState, () => {}, pending] },
  "@/lib/supabase/server": { createClient: async () => ({
    auth: { getClaims: async () => ({data: access === null ? null : {claims:{sub:id}}, error: null}) },
    rpc: async (name,args) => {
      calls.push({name,args});
      return name === "current_user_is_admin" ? {data:access,error:authError ? Error("PRIVATE") : null} : {data:id,error:rpcError};
    },
  }) },
};
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const mod = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync(file,"utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function("require","module","exports",code)(name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const base = name.startsWith("@/") ? path.resolve("src",name.slice(2)) : path.resolve(path.dirname(file),name);
      return load(fs.existsSync(base+".ts") ? base+".ts" : base+".tsx");
    }
    return require(name);
  },mod,mod.exports);
  modules.set(file,mod.exports); return mod.exports;
}
const { saveRestaurant } = load(path.resolve("src/app/admin/restaurants/actions.ts"));
const { restaurantInput,slugFromName } = load(path.resolve("src/lib/admin/restaurant-input.ts"));
function form(extra={}) {
  const result = new FormData();
  for (const [key,value] of Object.entries({name:"Test Cafe",slug:"test-cafe",category:"cafe",is_active:"on",...extra})) result.set(key,value);
  return result;
}
for (const denied of [false,null,"invalid"]) {
  access=denied; calls=[]; assert.ok((await saveRestaurant({},form())).error); assert.ok(!calls.some(c => c.name.startsWith("admin_")));
}
access=true; authError=true; calls=[]; assert.ok((await saveRestaurant({},form())).error); assert.equal(calls.length,1); authError=false;
assert.equal(slugFromName(" Café & Grill! "),"cafe-grill");
for (const invalid of [{name:" "},{slug:"BAD"},{category:"bar"},{price_level:"2.5"},{website_url:"javascript:alert(1)"},{instagram_url:"https://u:p@example.com"}]) assert.throws(() => restaurantInput(form(invalid)));
assert.equal((await saveRestaurant({},form())).savedId,id);
assert.equal(calls.at(-1).name,"admin_create_restaurant");
assert.equal(calls.at(-1).args.p_description,null);
assert.ok(paths.some(p => p[0] === "/places/[slug]"));
const edit = {id,updated_at:"2026-10-21T00:00:00.123456Z"};
await saveRestaurant({},form({...edit,personal_notes:"Ignore",is_favorite:"true"}));
assert.equal(calls.at(-1).name,"admin_update_restaurant");
assert.equal(calls.at(-1).args.p_expected_updated_at,edit.updated_at);
assert.ok(!("personal_notes" in calls.at(-1).args));
await saveRestaurant({},form({...edit,operation:"status",is_active:""}));
assert.deepEqual(calls.at(-1),{name:"admin_set_restaurant_active",args:{p_active:false,p_id:id,p_expected_updated_at:edit.updated_at}});
for (const invalid of [{id:"bad"},{id,updated_at:""}]) { calls=[]; assert.ok((await saveRestaurant({},form(invalid))).error); assert.equal(calls.length,1); }
for (const code of ["23505","40001","P0002","42501","22023","UNKNOWN"]) {
  rpcError={code,message:"SECRET SQL"}; paths=[];
  const result = await saveRestaurant({},form()); assert.ok(result.error); assert.ok(!result.error.includes("SECRET")); assert.equal(paths.length,0);
}
rpcError=null;
console.log("PASS action auth fail-closed, explicit RPC payloads, stable ID/exact timestamp, validation, safe errors, revalidation");
const { RestaurantForm, RestaurantStatus } = load(path.resolve("src/components/admin/restaurant-form.tsx"));
const row = {id,name:"Real Cafe",slug:"real-cafe",category:"cafe",short_description:"Real description",price_level:3,website_url:"https://example.com",instagram_url:null,is_active:true,updated_at:edit.updated_at};
const render = component => renderToStaticMarkup(component);
let html = render(react.createElement(RestaurantForm,{row}));
for (const value of ["Real Cafe","real-cafe","Real description","https://example.com",edit.updated_at,"Save changes","Changing it may break existing links"]) assert.ok(html.includes(value));
assert.ok(!html.includes("personal_notes"));
pending=true; html=render(react.createElement(RestaurantForm)); assert.match(html,/disabled/); assert.match(html,/Saving…/); pending=false;
uiState={error:"That slug is already in use."}; assert.match(render(react.createElement(RestaurantForm,{row})),/role="alert"/);
uiState={savedId:id}; assert.match(render(react.createElement(RestaurantForm,{row})),/Restaurant saved/);
uiState={}; assert.match(render(react.createElement(RestaurantStatus,{row})),/Deactivate/); assert.match(render(react.createElement(RestaurantStatus,{row:{...row,is_active:false}})),/Reactivate/);
console.log("PASS create/edit SSR real values, accessible labels, pending/error/success states, explicit status controls");
