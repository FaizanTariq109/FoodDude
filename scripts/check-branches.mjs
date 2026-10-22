import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url), modules = new Map();
const react = require("react"), { renderToStaticMarkup } = require("react-dom/server");
let readRows = [], readError = false;
let interactive = false, entered;
let access = true, authError = false, rpcError = null, calls = [], paths = [], uiState = {}, pending = false;
const id = "00000000-0000-4000-8000-000000000001";
const mocks = {
  "server-only": {},
  "@/lib/auth/require-admin": { requireAdmin: async () => { if(access !== true) throw Error("DENIED"); } }, "next/link": { __esModule: true, default: "a" },
  "next/cache": { revalidatePath: (...args) => paths.push(args) },
  react: { ...react, useActionState: () => [uiState, () => {}, pending], useState: initial => {
    if (!interactive) return react.useState(initial);
    entered ??= typeof initial === "function" ? initial() : initial;
    return [entered,value => { entered=typeof value === "function" ? value(entered) : value; }];
  } },
  "@/lib/supabase/server": { createClient: async () => ({
    auth: { getClaims: async () => ({data: access === null ? null : {claims:{sub:id}}, error: null}) },
    from: () => chain,
    rpc: (name,args) => {
      calls.push({name,args});
      if(name === "admin_restaurant_branches") return chain;
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
let offset = 0;
const chain = {
 select: value => { calls.push({select:value}); return chain; },
 eq: (key,value) => { calls.push({eq:[key,value]}); return chain; },
 order: () => chain,
 range: (start,end) => {offset=start; calls.push({range:[start,end]}); return chain;},
 abortSignal: async () => ({data:readRows.slice(offset,offset+100),error:readError ? Error("SECRET") : null}),
};
const { saveBranch } = load(path.resolve("src/app/admin/restaurants/branch-actions.ts"));
const { branchInput } = load(path.resolve("src/lib/admin/branch-input.ts"));
const { mapsUrl, phoneHref } = load(path.resolve("src/lib/branches.ts"));
const parent="00000000-0000-4000-8000-000000000003", version="2026-10-22T00:00:00.123456Z";
function form(extra={}) {
  const result=new FormData();
  for(const [key,value] of Object.entries({restaurant_id:parent,area:" Fixture area ",is_active:"on",...extra})) result.set(key,value);
  return result;
}
for(const denied of [false,null,"invalid"]) {
  access=denied; calls=[];
  assert.ok((await saveBranch({},form())).error); assert.ok(!calls.some(c=>c.name?.startsWith("admin_")));
}
access=true; authError=true; calls=[]; assert.ok((await saveBranch({},form())).error); assert.equal(calls.length,1); authError=false;
assert.equal((await saveBranch({},form())).savedId,id);
assert.equal(calls.at(-1).name,"admin_create_branch");
assert.deepEqual(calls.at(-1).args,{p_restaurant_id:parent,p_name:null,p_area:"Fixture area",p_address:null,p_phone:null,p_maps:null,p_latitude:null,p_longitude:null,p_active:true});
await saveBranch({},form({id,updated_at:version,role:"admin",user_id:"evil"}));
assert.equal(calls.at(-1).name,"admin_update_branch");
assert.equal(calls.at(-1).args.p_expected_updated_at,version);
assert.ok(!("role" in calls.at(-1).args)); assert.ok(!("user_id" in calls.at(-1).args));
await saveBranch({},form({id,updated_at:version,operation:"status",is_active:""}));
assert.deepEqual(calls.at(-1),{name:"admin_set_branch_active",args:{p_active:false,p_restaurant_id:parent,p_id:id,p_expected_updated_at:version}});
assert.ok(paths.some(p=>p[0]==="/places/[slug]"));
for(const invalid of [{restaurant_id:"bad"},{id:"bad"},{id,updated_at:""},{operation:"status"}]) {
  calls=[]; assert.ok((await saveBranch({},form(invalid))).error); assert.equal(calls.length,1);
}
for(const invalid of [{area:" "},{latitude:"NaN",longitude:"0"},{latitude:"Infinity",longitude:"0"},{latitude:"90.1",longitude:"0"},{latitude:"0",longitude:"-181"},{latitude:"0"},{longitude:"0"},{google_maps_url:"javascript:alert(1)"},{google_maps_url:"https://google.com.evil/maps"},{google_maps_url:"https://evil.com"}]) assert.throws(()=>branchInput(form(invalid)));
assert.deepEqual([branchInput(form({latitude:"0",longitude:"-180"})).p_latitude,branchInput(form({latitude:"0",longitude:"-180"})).p_longitude],[0,-180]);
for(const value of [null,"http://google.com/maps/x","https://u:p@google.com/maps/","https://google.com\\@evil/maps","https://www.google.com/maps\n/x","https://google.com.evil/maps","//google.com/maps/"]) assert.equal(mapsUrl(value),null);
for(const value of ["https://www.google.com/maps/place/fixture","https://maps.google.com/?q=fixture","https://maps.app.goo.gl/fixture","https://goo.gl/maps/fixture"]) assert.ok(mapsUrl(value));
assert.equal(phoneHref("+92 (300) 123-4567"),"tel:+923001234567");
for(const value of ["javascript:alert(1)","*123#",null,"bad phone"]) assert.equal(phoneHref(value),null);
for(const code of ["42501","40001","23505","P0002","22023","UNKNOWN"]) {
  rpcError={code,message:"SECRET"}; paths=[];
  const result=await saveBranch({},form()); assert.ok(result.error); assert.doesNotMatch(result.error,/SECRET/); assert.equal(paths.length,0);
}
rpcError=null;
console.log("PASS branch action authorization, safe payloads/errors, exact versions, revalidation, optional nulls, coordinates and links");
const row={id,restaurant_id:parent,name:"Fixture branch",area:"Fixture area",address:"Fixture address",phone:"+92 300 1234567",google_maps_url:"https://maps.app.goo.gl/fixture",latitude:31.5,longitude:74.3,is_active:true,created_at:version,updated_at:version};
const { BranchForm }=load(path.resolve("src/components/admin/branch-form.tsx"));
const render=element=>renderToStaticMarkup(element);
let html=render(react.createElement(BranchForm,{restaurantId:parent,row}));
for(const value of [row.name,row.area,row.address,row.phone,row.google_maps_url,version,"Save branch changes","Enter both coordinates"]) assert.ok(html.includes(value));
assert.doesNotMatch(html,/opening hours|Delete branch/i);
assert.match(render(react.createElement(BranchForm,{restaurantId:parent,row,statusOnly:true})),/Confirm: hide this branch/);
assert.match(render(react.createElement(BranchForm,{restaurantId:parent,row:{...row,is_active:false},statusOnly:true})),/Reactivate branch/);
pending=true; html=render(react.createElement(BranchForm,{restaurantId:parent})); assert.match(html,/disabled/); assert.match(html,/Saving…/); pending=false;
uiState={error:"Invalid branch"}; assert.match(render(react.createElement(BranchForm,{restaurantId:parent})),/role="alert"/);
uiState={savedId:id}; assert.match(render(react.createElement(BranchForm,{restaurantId:parent})),/Branch saved/); uiState={};
function descendants(element) {
  if(!element || typeof element!=="object") return [];
  return [element,...react.Children.toArray(element.props?.children).flatMap(descendants)];
}
interactive=true;
let tree=BranchForm({restaurantId:parent,row});
descendants(tree).find(e=>e.type==="input" && e.props.name==="area").props.onChange({target:{value:"New typed area"}});
uiState={error:"Review coordinates"}; tree=BranchForm({restaurantId:parent,row});
assert.equal(descendants(tree).find(e=>e.type==="input" && e.props.name==="area").props.value,"New typed area");
interactive=false; uiState={};
const { RestaurantBranches }=load(path.resolve("src/components/restaurants/restaurant-branches.tsx"));
html=render(react.createElement(RestaurantBranches,{branches:[row]}));
for(const value of [row.name,row.area,row.address,'href="tel:+923001234567"','rel="noopener noreferrer"',"opens in a new tab","Directions"]) assert.ok(html.includes(value));
assert.doesNotMatch(html,/Example branches|Explore this area|Show offers for/);
assert.match(render(react.createElement(RestaurantBranches,{branches:[]})),/No verified branch information/);
assert.match(render(react.createElement(RestaurantBranches,{branches:[],unavailable:true})),/temporarily unavailable/);
html=render(react.createElement(RestaurantBranches,{branches:[{...row,name:null,area:null,address:null,phone:"javascript:bad",google_maps_url:"javascript:bad"}]}));
assert.match(html,/Address not recorded/); assert.doesNotMatch(html,/href="javascript:|href="tel:/);
console.log("PASS branch forms real values, pending/error/success/status feedback; public real branches, safe labelled links and neutral missing/error states");
const { getPublicBranches }=load(path.resolve("src/lib/data/branches.ts"));
const { getAdminBranches }=load(path.resolve("src/lib/data/admin-branches.ts"));
readRows=[{...row,secret:"SECRET"}];
const publicRow=await getPublicBranches(parent);
assert.deepEqual(Object.keys(publicRow[0]).sort(),["id","restaurant_id","name","area","address","phone","google_maps_url","latitude","longitude"].sort());
assert.ok(calls.some(c=>c.eq?.[0]==="restaurant_id" && c.eq[1]===parent));
assert.doesNotMatch(calls.find(c=>c.select)?.select,/\*|is_active|created_at|updated_at/);
assert.equal((await getAdminBranches(parent))[0].updated_at,version);
readRows=[{...row,address:"Changed for next request"}]; assert.equal((await getPublicBranches(parent))[0].address,"Changed for next request");
readRows=Array.from({length:101},(_,i)=>({...row,id:String(i)}));
assert.equal((await getPublicBranches(parent)).length,101); assert.equal((await getAdminBranches(parent)).length,101);
readRows=[{...row,restaurant_id:id}]; await assert.rejects(getAdminBranches(parent),/Unexpected branch/);
readError=true; await assert.rejects(getPublicBranches(parent),/Unable/); await assert.rejects(getAdminBranches(parent),/Unable/); readError=false;
access=false; await assert.rejects(getAdminBranches(parent),/DENIED/); access=true;
const { BranchManagement }=load(path.resolve("src/components/admin/branch-management.tsx"));
readRows=[]; assert.match(render(await BranchManagement({restaurantId:parent,restaurantName:"Fixture Restaurant"})),/No branches have been entered/);
readRows=[row,{...row,id:parent,is_active:false}]; html=render(await BranchManagement({restaurantId:parent,restaurantName:"Fixture Restaurant"}));
assert.match(html,/2 branches · 1 active/); assert.match(html,/Inactive/);
readError=true; assert.match(render(await BranchManagement({restaurantId:parent,restaurantName:"Fixture Restaurant"})),/Branch information is unavailable/); readError=false;
console.log("PASS per-request public/admin reads, explicit projections, pagination, stable parent filtering, admin guards and branch list/error states");
