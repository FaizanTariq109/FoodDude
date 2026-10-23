// Action/data/SSR checks with a user-scoped transport fixture. No hosted writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url), React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const id='00000000-0000-4000-8000-000000000001', rid='00000000-0000-4000-8000-000000000002';
let authenticated=true, fault=false, catalogueFault=false, response, calls=[], invalidations=[], currentPath='/lists';
let lists=[{id,name:'Date Nights',description:'For good company and somewhere worth going.',user_list_entries:[{count:2}]}];
let entries=[{id:rid,list_id:id,restaurant_id:rid,notes:'Book a quiet table by the window.'},{id:'00000000-0000-4000-8000-000000000003',list_id:id,restaurant_id:id,notes:'Keep this private note even when a place closes.'}];
const restaurants=[{id:rid,name:'Evening Kitchen',slug:'evening-kitchen'},{id:'00000000-0000-4000-8000-000000000004',name:'A Little Coffee',slug:'a-little-coffee'}];
const client={auth:{getClaims:async()=>({data:{claims:authenticated?{sub:id}:{}},error:null})},from(table){
  const call={table,op:'read',filters:[],start:0,end:99};calls.push(call);
  const result=()=>{const failed=fault||(catalogueFault&&table==='restaurants');let data=(table==='user_lists'?lists:table==='user_list_entries'?entries:restaurants);if(table==='user_list_entries'&&call.columns==='list_id')data=data.filter(e=>e.restaurant_id===call.filters.find(([key])=>key==='restaurant_id')?.[1]);return response??{data:failed?null:data.slice(call.start,call.end+1),error:failed?{code:'SECRET'}:null}};
  const chain={select(value){call.columns=value;return chain},insert(value){call.op='insert';call.fields=value;return chain},update(value){call.op='update';call.fields=value;return chain},delete(){call.op='delete';return chain},eq(...args){call.filters.push(args);return chain},order(){return chain},range(a,b){call.start=a;call.end=b;return chain},abortSignal(){return chain},maybeSingle:async()=>{const r=result();return {...r,data:Array.isArray(r.data)?r.data[0]??null:r.data}},single:async()=>{const r=result();return {...r,data:Array.isArray(r.data)?r.data[0]??null:r.data}},then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)}};
  return chain;
}};
const mocks={
  'server-only':{},'@/lib/supabase/server':{createClient:async()=>client},
  'next/link':{__esModule:true,default:'a'},
  'next/navigation':{redirect(destination){throw Object.assign(Error('redirect'),{destination})},notFound(){throw Error('NOT_FOUND')},usePathname:()=>currentPath,useSearchParams:()=>new URLSearchParams(),useRouter:()=>({refresh(){}}),unstable_rethrow(error){if(error.destination)throw error}},
  'next/cache':{revalidatePath:(...args)=>invalidations.push(args)},
};
const modules=new Map();
function load(file){
  if(modules.has(file))return modules.get(file);
  const mod={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('require','module','exports',code)(key=>{
    if(key in mocks)return mocks[key];
    if(key.startsWith('@/')||key.startsWith('.')){
      const base=key.startsWith('@/')?path.resolve('src',key.slice(2)):path.resolve(path.dirname(file),key);
      return load(fs.existsSync(base+'.ts')?base+'.ts':base+'.tsx');
    }
    return require(key);
  },mod,mod.exports);modules.set(file,mod.exports);return mod.exports;
}
const {mutateList}=load(path.resolve('src/app/lists/actions.ts'));
const {getUserLists,getListSummaries,getSavedListIds}=load(path.resolve('src/lib/data/lists.ts'));
const page=load(path.resolve('src/app/lists/page.tsx')).default;
const detail=load(path.resolve('src/app/lists/[id]/page.tsx')).default;
const save=load(path.resolve('src/components/lists/save-restaurant.tsx')).SaveRestaurant;
const form=values=>{const data=new FormData();Object.entries(values).forEach(([key,value])=>data.set(key,value));return data};
const act=values=>mutateList({},form(values));
authenticated=false;
assert.match(renderToStaticMarkup(await page()),/Sign in to My Lists/);
assert.match(renderToStaticMarkup(await detail({params:Promise.resolve({id})})),/Sign in to My Lists/);
assert.equal((await save({restaurantId:rid})).props.authenticated,false);
assert.deepEqual(calls,[]);
for(const operation of ['create','edit','delete','add','notes','remove'])assert.match((await act({operation,list_id:id,name:'Hi',restaurant_id:rid,entry_id:rid,confirm:'yes'})).error,/sign in/);
assert.deepEqual(calls,[]); authenticated=true;
assert.match((await act({operation:'edit',list_id:'bad'})).error,/unavailable/);
assert.match((await act({operation:'create',name:'  '})).error,/Name/);
assert.match((await act({operation:'create',name:'x'.repeat(81)})).error,/Name/);
assert.match((await act({operation:'delete',list_id:id})).error,/Confirm/);
assert.match((await act({operation:'add',list_id:id,restaurant_id:'bad'})).error,/public restaurant/);
assert.match((await act({operation:'notes',list_id:id,entry_id:rid,notes:'x'.repeat(5001)})).error,/Notes/);
assert.equal(calls.length,0);
response={data:{id},error:null};
await assert.rejects(act({operation:'create',name:'  Favorites  ',owner_id:rid}),{destination:`/lists/${id}`});
assert.deepEqual(calls.at(-1).fields,{name:'Favorites',description:null});
for(const operation of ['edit','add','notes','remove']){
  assert.ok((await act({operation,list_id:id,name:'Dinner',description:'Tonight',restaurant_id:rid,entry_id:rid,notes:'Just mine'})).success);
  const call=calls.at(-1);
  if(operation!=='add')assert.ok(call.filters.some(([key,val])=>key===(operation==='edit'?'id':'list_id')&&val===id));
  if(operation==='notes')assert.deepEqual(call.fields,{notes:'Just mine'});
}
await assert.rejects(act({operation:'delete',list_id:id,confirm:'yes'}),{destination:'/lists'});
response={data:null,error:{code:'23505',message:'SECRET'}};
const duplicate=await act({operation:'add',list_id:id,restaurant_id:rid});assert.match(duplicate.error,/already in/);assert.equal(duplicate.duplicate,true);
response={data:null,error:null};assert.match((await act({operation:'edit',list_id:id,name:'Dinner'})).error,/unavailable/);
response={data:null,error:{code:'42501',message:'SECRET'}};assert.doesNotMatch((await act({operation:'remove',list_id:id,entry_id:rid})).error,/SECRET/);
response=undefined;
assert.ok(invalidations.some(([p,t])=>p==='/'&&t==='layout'));
console.log('PASS every action authenticates, validates IDs/text, scopes writes, handles duplicates/stale records, confirms deletion, sanitizes errors and revalidates');
await assert.rejects(detail({params:Promise.resolve({id:'bad'})}),/NOT_FOUND/);
const listHTML=renderToStaticMarkup(await page());assert.match(listHTML,/Date Nights/);
assert.match(listHTML,/2 restaurants/);assert.doesNotMatch(listHTML,/Make a little list|<textarea|<aside/);
assert.ok(listHTML.indexOf('New List')<listHTML.indexOf('Date Nights'));
assert.equal((await getListSummaries(client))[0].restaurantCount,2);
assert.deepEqual(await getSavedListIds(client,rid),[id]);
const saveProps=(await save({restaurantId:rid})).props;
assert.equal(saveProps.authenticated,true);assert.deepEqual(saveProps.savedIds,[id]);
assert.ok(calls.some(c=>c.table==='user_list_entries'&&c.columns==='list_id'&&c.filters.some(([key,val])=>key==='restaurant_id'&&val===rid)));

const detailHTML=renderToStaticMarkup(await detail({params:Promise.resolve({id})}));
assert.doesNotMatch(detailHTML,/<textarea|Edit your list|<select/);assert.match(detailHTML,/role="combobox"/);assert.match(detailHTML,/Edit private note/);assert.match(detailHTML,/Evening Kitchen/);assert.match(detailHTML,/Restaurant unavailable/);assert.match(detailHTML,/Keep this private note/);assert.doesNotMatch(detailHTML,/secret-fixture/);
catalogueFault=true;assert.equal((await detail({params:Promise.resolve({id})})).props.catalogueUnavailable,true);catalogueFault=false;
lists=[];assert.match(renderToStaticMarkup(await page()),/Create your first list/);
assert.equal((await save({restaurantId:rid})).props.lists.length,0);
await assert.rejects(detail({params:Promise.resolve({id})}),/NOT_FOUND/);
lists=Array.from({length:205},(_,i)=>({id:String(i),name:`List ${i}`,description:null}));
assert.equal((await getUserLists(client)).length,205);assert.equal((await getListSummaries(client)).length,205);
const originalEntries=entries;entries=Array.from({length:205},(_,i)=>({id:String(i),list_id:String(i),restaurant_id:rid,notes:null}));assert.equal((await getSavedListIds(client,rid)).length,205);entries=originalEntries;
fault=true;await assert.rejects(getUserLists(client),/temporarily unavailable/);
assert.equal((await save({restaurantId:rid})).props.unavailable,true);fault=false;
console.log('PASS anonymous private-read isolation, counts/projections, compact SSR, saved membership, picker semantics, stale IDs, note previews, neutral catalogue failures and pagination');
const {AppShell}=load(path.resolve('src/components/layout/app-shell.tsx'));
for(const pathname of ['/lists','/lists/'+id,'/places/fuoco']){currentPath=pathname;const shell=renderToStaticMarkup(React.createElement(AppShell,{accountNavigation:null},'fixture'));assert.match(shell,new RegExp('href="'+(pathname.startsWith('/lists')?'/lists':'/discover')+'" aria-current="page"'));assert.doesNotMatch(shell,/href="\/places"/)}
console.log('PASS primary/mobile My Lists navigation, nested active state, catalogue-to-Discover active state');
{
  const {AppShell}=load(path.resolve('src/components/layout/app-shell.tsx'));
  const shell=renderToStaticMarkup(React.createElement(AppShell,{accountNavigation:null},'fixture'));
  const footer=shell.slice(shell.indexOf('<footer'),shell.indexOf('</footer>'));
  for(const href of ['/','/discover','/lists','/offers','mailto:faizan3san@gmail.com']) assert.ok(footer.includes(`href="${href}"`));
  assert.match(footer,/Lahore, Pakistan/);assert.match(footer,/Contact &amp; Feedback/);assert.ok(footer.includes(String(new Date().getFullYear())));
  assert.doesNotMatch(shell,/Good company\.|Somewhere worth going|A little appetite|A lot of Lahore|A personal list, brought to life/);
  assert.doesNotMatch(footer,/privacy|terms|instagram|facebook/i);
}
console.log('PASS footer navigation/contact/current year and removal of decorative sidebar copy');
if(process.argv.includes('--fixtures')){
  lists=[{id,name:'Date Nights',description:'For good company and somewhere worth going.',user_list_entries:[{count:2}]}];
  const {AppShell}=load(path.resolve('src/components/layout/app-shell.tsx'));
  const account=React.createElement('nav',{className:'account-links'},React.createElement('a',{href:'/admin'},'Admin'),React.createElement('a',{href:'/login'},'Sign out'));
  const css=fs.readdirSync('.next/static/chunks').filter(n=>n.endsWith('.css')).map(n=>fs.readFileSync(`.next/static/chunks/${n}`,'utf8')).join('\n');
  fs.mkdirSync('.cache/lists-review',{recursive:true});
  for (const font of ['Fraunces','Manrope']) fs.copyFileSync(`src/app/fonts/${font}.ttf`,`.cache/lists-review/${font}.ttf`);
  const fontCSS="@font-face{font-family:Fraunces;src:url('/Fraunces.ttf')}@font-face{font-family:Manrope;src:url('/Manrope.ttf')}html{--font-display:Fraunces;--font-interface:Manrope}";
  for(const [name,component] of [['overview',await page()],['detail',await detail({params:Promise.resolve({id})})]]){
    currentPath=name==='overview'?'/lists':`/lists/${id}`;
    const html=renderToStaticMarkup(React.createElement(AppShell,{accountNavigation:account},component));
    fs.writeFileSync(`.cache/lists-review/${name}.html`,`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}${fontCSS}</style></head><body>${html}</body></html>`);
  }
  fs.writeFileSync('.cache/lists-review/index.html','<!doctype html><html><body style="margin:0;background:#211720;color:#fff"><h1>Desktop 1280px · Mobile 390px (SSR fixtures)</h1><div style="display:flex;gap:20px;align-items:start"><iframe title="Desktop" width="1280" height="1500" src="detail.html"></iframe><iframe title="Mobile" width="390" height="2000" src="detail.html"></iframe></div></body></html>');
  console.log('Wrote actual-component SSR layout fixtures to .cache/lists-review (synthetic data only).');
}
