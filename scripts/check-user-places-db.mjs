// Isolated PostgreSQL/RLS tests. No hosted connections or credentials.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const alice="00000000-0000-4000-8000-000000000001",bob="00000000-0000-4000-8000-000000000002";
const q=async(sql,args)=>(await db.query(sql,args)).rows;
const denied=async(sql,args,codes=["42501"])=>assert.rejects(q(sql,args),e=>codes.includes(e.code));
async function as(id,fn,role="authenticated") { await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${id??""}',false)`); try { return await fn(); } finally { await db.exec("reset role"); } }
const snapshot=()=>q(`select c.relname,c.relacl::text,c.relrowsecurity,
 (select json_agg(p order by policyname)::text from pg_policies p where p.tablename=c.relname) policies
 from pg_class c where c.relnamespace in ('public'::regnamespace,'private'::regnamespace) and c.relkind='r'
 and c.relname not in ('user_places','user_list_entries') order by c.relname`);
try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 grant usage on schema public to anon,authenticated,service_role;
 create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated,service_role;
 insert into auth.users(id) values('${alice}'),('${bob}');`);
 const folder=new URL('../supabase/migrations/',import.meta.url),files=(await readdir(folder)).filter(f=>f.endsWith('.sql')).sort();
 for(const file of files.slice(0,11)) await db.exec(await readFile(new URL(file,folder),'utf8'));
 const restaurant=(await q("insert into public.restaurants(name,slug,category,is_active) values('Official fixture','official-fixture','restaurant',true) returning id"))[0].id;
 const list=await as(alice,async()=>(await q("insert into public.user_lists(name) values('Custom plan') returning id"))[0].id);
 const second=await as(alice,async()=>(await q("insert into public.user_lists(name) values('Second plan') returning id"))[0].id);
 const bobList=await as(bob,async()=>(await q("insert into public.user_lists(name) values('Bob plan') returning id"))[0].id);
 await as(alice,()=>q("insert into public.user_list_entries(list_id,restaurant_id,notes) values($1,$2,'Existing private note')",[list,restaurant]));
 const before=await snapshot(),entryBefore=await q('select * from public.user_list_entries order by id');
 const fnBefore=await q("select pg_get_functiondef('public.set_restaurant_liked(uuid,boolean)'::regprocedure) definition");
 await db.exec(await readFile(new URL(files[11],folder),'utf8'));
 assert.deepEqual(await snapshot(),before);
 assert.deepEqual((await q('select * from public.user_list_entries order by id')).map(({user_place_id,...row})=>{assert.equal(user_place_id,null);return row;}),entryBefore);
 assert.deepEqual(await q("select pg_get_functiondef('public.set_restaurant_liked(uuid,boolean)'::regprocedure) definition"),fnBefore);
 console.log('PASS 012 additive schema; original public entries/notes, catalogue, list policies, grants and liked RPC unchanged');
 let place,bobPlace;
 await as(alice,async()=>{
  place=(await q("insert into public.user_places(name,category,area,notes,google_maps_url) values('Quiet Cafe','cafe','My neighborhood','Private place note','https://maps.app.goo.gl/example') returning id"))[0].id;
  assert.equal((await q('select notes from public.user_places where id=$1',[place]))[0].notes,'Private place note');
  await q("update public.user_places set name='Evening Cafe', address='Owner-entered address' where id=$1",[place]);
  for(const field of ['owner_id','id','created_at']) await denied(`update public.user_places set ${field}=${field} where id=$1`,[place]);
  await denied('insert into public.user_places(owner_id,name,category) values($1,$2,$3)',[bob,'Spoof','cafe']);
  for(const values of [["",'cafe'],['\n\t','cafe'],['Name','bar'],['x'.repeat(121),'restaurant']]) await denied('insert into public.user_places(name,category) values($1,$2)',values,['23514']);
  for(const url of ['javascript:alert(1)','https://evil.invalid/maps','https://google.com.evil.invalid/maps','https://www.google.com@evil.invalid/maps','https://google.com/maps\n']) await denied('update public.user_places set google_maps_url=$1 where id=$2',[url,place],['23514']);
  for(const url of ['https://www.google.com/maps?q=test','https://maps.google.com/?q=test','https://goo.gl/maps/example']) await q('update public.user_places set google_maps_url=$1 where id=$2',[url,place]);
 });
 await as(bob,async()=>{bobPlace=(await q("insert into public.user_places(name,category) values('Bob secret','restaurant') returning id"))[0].id;assert.deepEqual(await q('select * from public.user_places where id=$1',[place]),[]);assert.deepEqual(await q("update public.user_places set name='Attack' where id=$1 returning id",[place]),[]);assert.deepEqual(await q('delete from public.user_places where id=$1 returning id',[place]),[]);});
 await q('insert into private.admin_memberships(user_id) values($1)',[bob]);
 await as(bob,async()=>assert.deepEqual(await q('select * from public.user_places where id=$1',[place]),[]));
 console.log('PASS create/edit/read, field constraints, safe Maps URLs, immutable identity/ownership; two-user and admin isolation');
 await as(alice,async()=>{
  for(const id of [list,second]) await q("insert into public.user_list_entries(list_id,user_place_id,notes) values($1,$2,'Membership note')",[id,place]);
  await denied('insert into public.user_list_entries(list_id,user_place_id) values($1,$2)',[list,place],['23505']);
  await denied('insert into public.user_list_entries(list_id,restaurant_id) values($1,$2)',[list,restaurant],['23505']);
  await denied('insert into public.user_list_entries(list_id,user_place_id) values($1,$2)',[list,bobPlace]);
  await denied('insert into public.user_list_entries(list_id,user_place_id) values($1,$2)',[bobList,place]);
  await denied('insert into public.user_list_entries(list_id) values($1)',[list],['23514','42501']);
  await denied('insert into public.user_list_entries(list_id,restaurant_id,user_place_id) values($1,$2,$3)',[list,restaurant,place],['23514','42501']);
  await denied('update public.user_list_entries set user_place_id=$1 where list_id=$2',[bobPlace,list]);
  await denied('update public.user_list_entries set restaurant_id=$1 where list_id=$2',[restaurant,list]);
  await denied('update public.user_list_entries set list_id=$1 where list_id=$2',[bobList,list]);
  await q("update public.user_list_entries set notes='Changed membership note' where list_id=$1 and user_place_id=$2",[list,place]);
  await q('delete from public.user_list_entries where list_id=$1 and user_place_id=$2',[second,place]);
  await q('insert into public.user_list_entries(list_id,user_place_id) values($1,$2)',[second,place]);
 });
 await as(bob,()=>denied('insert into public.user_list_entries(list_id,user_place_id) values($1,$2)',[bobList,place]));
 for(const role of ['anon','service_role']) await as(null,async()=>{
  for(const sql of ['select * from public.user_places',"insert into public.user_places(name,category) values('No','cafe')","update public.user_places set notes='No'",'delete from public.user_places']) await denied(sql);
 },role);
 await as(null,async()=>{assert.deepEqual(await q('select * from public.user_places'),[]);await denied("insert into public.user_places(name,category) values('No identity','cafe')",[],['23502','42501']);});
 console.log('PASS anonymous/null restrictions; multi-list membership, cross-owner reference attacks, exactly-one reference, duplicate protection and immutable relationships');
 await as(alice,async()=>{
  const liked=(await q("select id from public.user_lists where kind='liked'"))[0].id;
  await q('insert into public.user_list_entries(list_id,user_place_id) values($1,$2)',[liked,place]);
  await q('select public.set_restaurant_liked($1,true)',[restaurant]);
  await q('select public.set_restaurant_liked($1,true)',[restaurant]);
  assert.equal((await q('select count(*)::int n from public.user_list_entries where list_id=$1',[liked]))[0].n,2);
  await q('select public.set_restaurant_liked($1,false)',[restaurant]);
  assert.equal((await q('select count(*)::int n from public.user_list_entries where list_id=$1 and user_place_id=$2',[liked,place]))[0].n,1);
 });
 await q('update public.restaurants set is_active=false where id=$1',[restaurant]);
 await as(alice,async()=>{assert.deepEqual(await q('select id from public.restaurants where id=$1',[restaurant]),[]);assert.equal((await q('select notes from public.user_list_entries where list_id=$1 and restaurant_id=$2',[list,restaurant]))[0].notes,'Existing private note');await denied('insert into public.user_list_entries(list_id,restaurant_id) values($1,$2)',[second,restaurant]);await denied('select public.set_restaurant_liked($1,true)',[restaurant]);await q('delete from public.user_places where id=$1',[place]);});
 assert.deepEqual(await q('select id from public.user_list_entries where user_place_id=$1',[place]),[]);
 assert.deepEqual((await q('select * from public.user_list_entries order by id')).map(row=>{const original={...row};delete original.user_place_id;return original;}),entryBefore);
 assert.equal((await q('select count(*)::int n from public.user_places where id=$1',[bobPlace]))[0].n,1);
 assert.equal((await q('select count(*)::int n from public.user_lists where id in ($1,$2)',[list,second]))[0].n,2);
 console.log('PASS likes with mixed references; inactive public references remain private; deleting own place cascades only its memberships and leaves lists, official entries/notes and other owners intact');
 await q('delete from auth.users where id=$1',[bob]);assert.deepEqual(await q('select id from public.user_places where id=$1',[bobPlace]),[]);
} finally { await db.close(); }
