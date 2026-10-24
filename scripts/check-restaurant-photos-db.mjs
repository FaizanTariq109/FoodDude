// Real isolated PostgreSQL, simulated Storage metadata; never hosted writes.
import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {pathToFileURL}from'node:url';import{resolve}from'node:path';
const {PGlite}=await import(pathToFileURL(resolve(process.argv[2])).href);const db=new PGlite();
const admin='00000000-0000-4000-8000-000000000001',member='00000000-0000-4000-8000-000000000002',r1='10000000-0000-4000-8000-000000000001',r2='10000000-0000-4000-8000-000000000002';
const q=async(s,a)=>(await db.query(s,a)).rows;
async function as(id,fn,role='authenticated'){await db.exec(`set role ${role};select set_config('request.jwt.claim.sub','${id??''}',false)`);try{return await fn();}finally{await db.exec('reset role');}}
const deny=(s,a,codes=['42501'])=>assert.rejects(q(s,a),e=>codes.includes(e.code));
const gallery=async(r=r1)=>(await q('select public.admin_restaurant_photos($1) g',[r]))[0].g;
const save=async(g,images,r=r1)=>(await q('select public.admin_save_restaurant_photos($1,$2,$3) g',[r,g.version,JSON.stringify(images)]))[0].g;
const snap=()=>q(`select c.relname,c.relacl::text,c.relrowsecurity,(select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) policies from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and c.relname<>'restaurant_images' order by c.relname`);
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to anon,authenticated,service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;create schema storage;grant usage on schema storage to anon,authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner_id text,metadata jsonb,created_at timestamptz default now(),unique(bucket_id,name));alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to anon,authenticated;create policy existing_broad_policy on storage.objects for all to public using(true) with check(true);`);
 const dir=new URL('../supabase/migrations/',import.meta.url),files=(await fs.readdir(dir)).filter(f=>f.endsWith('.sql')).sort();for(const f of files.slice(0,13))await db.exec(await fs.readFile(new URL(f,dir),'utf8'));
 await q('insert into auth.users(id) values($1),($2)',[admin,member]);await q('insert into private.admin_memberships(user_id) values($1)',[admin]);
 await q("insert into public.restaurants(id,name,slug,category) values($1,'Synthetic one','synthetic-one','restaurant'),($2,'Synthetic two','synthetic-two','cafe')",[r1,r2]);
 await as(member,()=>q("insert into public.user_places(name,category,notes) values('Private fixture','cafe','Private preserved note')"));
 await q("insert into public.restaurant_images(restaurant_id,image_url,alt_text) values($1,'https://legacy.example.invalid/photo.jpg','Unverified legacy fixture')",[r2]);
 const legacy=await q('select * from public.restaurant_images');
 const before=await snap(),restaurants=await q('select * from public.restaurants order by id'),places=await q('select * from public.user_places order by id');
 await db.exec(await fs.readFile(new URL(files[13],dir),'utf8'));
 assert.deepEqual((await q('select * from public.restaurant_images')).map(({photo_object_id,thumbnail_object_id,updated_at,...old})=>{assert.equal(photo_object_id,null);assert.equal(thumbnail_object_id,null);assert(updated_at);return old;}),legacy);
 assert.deepEqual(await snap(),before);assert.deepEqual(await q('select * from public.restaurants order by id'),restaurants);assert.deepEqual(await q('select * from public.user_places order by id'),places);
 assert.equal((await q("select public from storage.buckets where id='restaurant-photos'"))[0].public,true);assert.equal((await q("select public from storage.buckets where id='user-place-photos'"))[0].public,false);
 const upload=async(restaurant,nonce,suffix,size=100,mime='image/webp')=>(await q("insert into storage.objects(bucket_id,name,owner_id,metadata) values('restaurant-photos',$1,$2,$3) returning id",[`${restaurant}/${nonce}/${suffix}.webp`,admin,{size,mimetype:mime}]))[0].id;
 let second;
 await as(admin,async()=>{
   const nonce='20000000-0000-4000-8000-000000000001';const full=await upload(r1,nonce,'full'),card=await upload(r1,nonce,'card');
   const row={id:'30000000-abcd-4000-8000-000000000001',photo_object_id:full,thumbnail_object_id:card,alt_text:'Synthetic full frame',is_cover:true};
   let g=await gallery();g=await save(g,[row]);assert.equal(g.images.length,1);
   await deny('select public.admin_save_restaurant_photos($1,$2,$3)',[r1,g.version,JSON.stringify([row,{...row,id:row.id.toUpperCase(),is_cover:false}])],['22023']);
   await deny('insert into public.restaurant_images(restaurant_id,storage_path) values($1,$2)',[r1,'bad']);
   await deny('delete from storage.objects where id=$1',[full],['23001','23503']);assert.deepEqual(await q("update storage.objects set name='renamed' where id=$1 returning id",[full]),[]);
   await deny('select public.admin_save_restaurant_photos($1,$2,$3)',[r1,'stale',JSON.stringify([row])],['40001']);
   await deny('select public.admin_save_restaurant_photos($1,$2,$3)',[r2,(await gallery(r2)).version,JSON.stringify([row])],['42501']);
   const n2='20000000-0000-4000-8000-000000000002',full2=await upload(r2,n2,'full'),card2=await upload(r2,n2,'card');
   await deny('select public.admin_save_restaurant_photos($1,$2,$3)',[r1,g.version,JSON.stringify([{...row,photo_object_id:full2,thumbnail_object_id:card2}])],['22023']);
   const n3='20000000-0000-4000-8000-000000000003';const full3=await upload(r1,n3,'full'),card3=await upload(r1,n3,'card');second={...row,id:'30000000-0000-4000-8000-000000000002',photo_object_id:full3,thumbnail_object_id:card3,is_cover:false};
   g=await save(g,[row,second]);assert.equal(g.images.length,2);
   await deny('select public.admin_save_restaurant_photos($1,$2,$3)',[r1,g.version,JSON.stringify([row,{...second,is_cover:true}])],['22023']);
   g=await save(g,[{...second,is_cover:true,alt_text:'Reordered synthetic view'},{...row,is_cover:false}]);assert.equal(g.images[0].id,second.id);assert.equal(g.images[0].is_cover,true);assert.equal(g.images[0].alt_text,'Reordered synthetic view');
   await deny("insert into storage.objects(bucket_id,name,owner_id,metadata) values('restaurant-photos',$1,$2,$3)",[`${r1}/${n3}/card.webp`,admin,{size:163841,mimetype:'image/webp'}]);
   await deny("insert into storage.objects(bucket_id,name,owner_id,metadata) values('restaurant-photos',$1,$2,$3)",[`${r1}/${n3}/full.webp`,admin,{size:1,mimetype:'image/svg+xml'}]);
   // Committed-object checks reject preflight-only objects even though upload probes are allowed.
   const probe=(await q("insert into storage.objects(bucket_id,name,owner_id,metadata) values('restaurant-photos',$1,$2,$3) returning id",[`${r1}/20000000-0000-4000-8000-000000000004/full.webp`,admin,{contentLength:100,mimetype:'image/webp'}]))[0].id;
   await deny('select public.admin_save_restaurant_photos($1,$2,$3)',[r1,g.version,JSON.stringify([{...row,photo_object_id:probe}])],['22023']);
 });
 await as(null,async()=>{assert.equal((await q('select id,alt_text,storage_path from public.restaurant_images')).length,2);await deny('select public.admin_restaurant_photos($1)',[r1]);await deny('select public.admin_save_restaurant_photos($1,$2,$3)',[r1,'','[]']);assert.deepEqual(await q("select id from storage.objects where bucket_id='restaurant-photos'"),[]);await deny("insert into storage.objects(bucket_id,name,owner_id,metadata) values('restaurant-photos','bad',$1,'{}')",[admin]);},'anon');
 await as(member,async()=>{await deny('select public.admin_restaurant_photos($1)',[r1]);await deny('select public.admin_save_restaurant_photos($1,$2,$3)',[r1,'','[]']);await deny("insert into storage.objects(bucket_id,name,owner_id,metadata) values('restaurant-photos',$1,$2,$3)",[`${r1}/20000000-0000-4000-8000-000000000006/full.webp`,member,{size:100,mimetype:'image/webp'}]);assert.deepEqual(await q("select id from storage.objects where bucket_id='restaurant-photos'"),[]);});

 let privateObject;
 await as(member,async()=>{privateObject=(await q("insert into storage.objects(bucket_id,name,owner_id,metadata) values('user-place-photos',$1,$2,$3) returning id",[member+'/'+member+'.webp',member,{size:100,mimetype:'image/webp'}]))[0].id;assert.equal((await q('select id from storage.objects where id=$1',[privateObject])).length,1);});
 await as(admin,async()=>assert.deepEqual(await q('select id from storage.objects where id=$1',[privateObject]),[]));
 await as(null,async()=>assert.deepEqual(await q('select id from storage.objects where id=$1',[privateObject]),[]),'anon');
 await q('update public.restaurants set is_active=false where id=$1',[r1]);await as(null,async()=>assert.deepEqual(await q('select id from public.restaurant_images'),[]),'anon');
 await as(admin,async()=>{let g=await gallery();assert.equal(g.images.length,2);const removed=g.images[1];g=await save(g,[g.images[0]]);await q('delete from storage.objects where id in ($1,$2)',[removed.photo_object_id,removed.thumbnail_object_id]);g=await save(g,[]);assert.equal(g.images.length,0);await q('delete from storage.objects where id in ($1,$2)',[second.photo_object_id,second.thumbnail_object_id]);});
 console.log('PASS 014: existing records/ACL/RLS/private photos preserved; admin-only RPC/storage, public active metadata, forged/cross-restaurant references rejected, preflight bounds, one-cover, immutable objects, stale versions, order/alt/delete/orphan protection');
}catch(e){console.error(e.message,e.code,e.position);process.exitCode=1;}finally{await db.close();}
