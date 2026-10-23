// Actual component/action/data orchestration tests; no hosted requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const id='00000000-0000-4000-8000-000000000001',rid='00000000-0000-4000-8000-000000000002';
let authenticated=true,exists=true,pending=false,started=[],invalidations=[],release;
let gate=new Promise(resolve=>release=resolve);
const client={from(table){const chain={select(){return chain},order(){return chain},range(){return chain},eq(){return chain},abortSignal(){return chain},update(){return chain},insert(){return chain},maybeSingle:async()=>({data:exists?{id,name:'Owner list',kind:'custom'}:null,error:null}),single:async()=>({data:{id},error:null}),then(resolve,reject){started.push(table);return gate.then(()=>({data:table==='restaurants'?[{id:rid,name:'Official',category:'cafe',slug:'official'}]:[{id:rid,restaurant_id:rid,user_place_id:null,notes:'Private note'}],error:null})).then(resolve,reject)}};return chain;}};
const mocks={'server-only':{},'next/link':{__esModule:true,default:'a',useLinkStatus:()=>({pending})},'next/navigation':{usePathname:()=>'/lists',useSearchParams:()=>new URLSearchParams(),useRouter:()=>({refresh(){}}),notFound(){throw Error('NOT_FOUND')},unstable_rethrow(){},redirect(){throw Error('redirect')}},'next/cache':{revalidatePath:(...args)=>invalidations.push(args)},'@/lib/data/lists':{listSession:async()=>({authenticated,client})},'@/lib/data/user-places':{getUserPlaces:async()=>{started.push('user_places');await gate;return [];}},'@/components/lists/liked-places-provider':{LikedPlacesProvider:({children})=>children}};
const modules=new Map();
function load(file){file=path.resolve(file);if(modules.has(file))return modules.get(file);const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(name=>{if(name in mocks)return mocks[name];if(name.startsWith('@/')||name.startsWith('.')){const stem=name.startsWith('@/')?path.resolve('src',name.slice(2)):path.resolve(path.dirname(file),name);return load(fs.existsSync(stem+'.ts')?stem+'.ts':stem+'.tsx');}return require(name);},mod,mod.exports);modules.set(file,mod.exports);return mod.exports;}
const page=load('src/app/lists/[id]/page.tsx').default;
const result=page({params:Promise.resolve({id})});
for(let i=0;i<30;i++)await Promise.resolve();
assert.deepEqual(new Set(started),new Set(['user_list_entries','restaurants','user_places']),'all three independent reads start before any finishes');
release();const detail=await result;assert.equal(detail.props.entries[0].notes,'Private note');assert.equal(detail.props.restaurants[0].name,'Official');
started=[];authenticated=false;assert.match(renderToStaticMarkup(await page({params:Promise.resolve({id})})),/Sign in to My Lists/);assert.deepEqual(started,[]);
authenticated=true;exists=false;await assert.rejects(page({params:Promise.resolve({id})}),/NOT_FOUND/);assert.deepEqual(started,[]);exists=true;
const {mutateList}=load('src/app/lists/actions.ts');
const form=new FormData();for(const [k,v]of Object.entries({operation:'notes',list_id:id,entry_id:rid,notes:'Edited private note'}))form.set(k,v);
assert((await mutateList({},form)).success);assert.deepEqual(invalidations,[[`/lists/${id}`]],'notes only invalidate their private page');
invalidations=[];form.set('operation','add');form.set('restaurant_id',rid);assert((await mutateList({},form)).success);assert(invalidations.some(([p,t])=>p==='/'&&t==='layout'),'membership still refreshes hearts and lists');
const {AppShell}=load('src/components/layout/app-shell.tsx');const html=renderToStaticMarkup(React.createElement(AppShell,{accountNavigation:null},'Content'));
assert.match(html,/<footer class="site-footer"><div class="footer-inner container">/);assert.doesNotMatch(html,/<footer class="[^"]*container/);
assert.match(html,/mailto:faizan3san@gmail.com/);assert.match(html,/Footer navigation/);assert.match(html,/Contact &amp; Feedback/);
const {LinkPending}=load('src/components/layout/link-pending.tsx');pending=true;assert.match(renderToStaticMarkup(React.createElement(LinkPending)),/Opening page/);pending=false;assert.doesNotMatch(renderToStaticMarkup(React.createElement(LinkPending)),/Opening page/);
console.log('PASS owner authorization before parallel reads, unchanged private DTOs, narrow notes/global membership invalidation, uncapped footer shell/content preservation and accessible navigation pending state');
if(process.argv[2]){const layouts=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));assert.equal(layouts.length,5);for(const r of layouts){assert(Math.abs(r.footer.right-r.app.right)<1);assert(Math.abs(r.footer.left-r.app.left)<1);assert(r.scrollWidth<=r.clientWidth);assert(r.inner.width<=1281);}console.log('PASS actual browser footer bounds and overflow at all five target widths');}
