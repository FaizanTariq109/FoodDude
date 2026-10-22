// In-memory PostgreSQL fixtures only. No network or hosted writes.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
if (!process.argv[2]) throw Error("Pass the temporary PGlite dist/index.js path.");
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const admin = "00000000-0000-4000-8000-000000000001", member = "00000000-0000-4000-8000-000000000002";
const q = async (sql, args) => (await db.query(sql,args)).rows;
async function as(role, sub, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${sub ?? ""}',false)`);
  try { return await fn(); } finally { await db.exec("reset role"); }
}
const fails = (code, sql, args) => assert.rejects(db.query(sql,args), {code});
const create = "select public.admin_create_branch($1,$2,$3,$4,$5,$6,$7,$8,$9) id";
const update = "select public.admin_update_branch($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) id";
const status = "select public.admin_set_branch_active($1,$2,$3,$4) id";
const read = "select *,updated_at::text version from public.admin_restaurant_branches($1)";
const fields = [null,"Fixture Area",null,null,null,null,null,true];
const projection = "id,restaurant_id,name,area,address,phone,google_maps_url,latitude,longitude";
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon,authenticated,service_role;
    create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated,service_role;
    insert into auth.users(id) values ('${admin}'),('${member}');`);
  const folder = new URL("../supabase/migrations/",import.meta.url);
  const files = (await readdir(folder)).filter(n => n.endsWith(".sql")).sort();
  assert.equal(files.length,9);
  for (const name of files.slice(0,8)) await db.exec(await readFile(new URL(name,folder),"utf8"));
  await db.exec(await readFile(new URL("../supabase/seed.sql",import.meta.url),"utf8"));
  const originals = await q("select * from public.restaurants order by id");
  const originalBranches = await q("select * from public.restaurant_branches order by id");
  const originalPolicies = await q("select * from pg_policies order by tablename,policyname");
  const originalGrants = await q("select relname,relacl::text from pg_class where relnamespace='public'::regnamespace and relkind='r' order by relname");
  await db.exec(await readFile(new URL(files[8],folder),"utf8"));
  assert.deepEqual(await q("select * from public.restaurants order by id"),originals);
  assert.deepEqual(await q("select * from public.restaurant_branches order by id"),originalBranches);
  assert.deepEqual(await q("select * from pg_policies where policyname<>'branches_public_active' order by tablename,policyname"),originalPolicies);
  assert.deepEqual(await q("select relname,relacl::text from pg_class where relnamespace='public'::regnamespace and relkind='r' order by relname"),originalGrants);
  for (const role of ["anon","authenticated"]) {
    assert.equal((await q("select has_table_privilege($1,'public.restaurant_branches','SELECT') allowed",[role]))[0].allowed,false);
    const cols = await q("select attname from pg_attribute where attrelid='public.restaurant_branches'::regclass and attnum>0 and not attisdropped");
    for (const {attname} of cols) {
      assert.equal((await q("select has_column_privilege($1,'public.restaurant_branches',$2,'SELECT') allowed",[role,attname]))[0].allowed,projection.split(',').includes(attname));
      assert.equal((await q("select has_column_privilege($1,'public.restaurant_branches',$2,'INSERT,UPDATE,REFERENCES') allowed",[role,attname]))[0].allowed,false);
    }
  }
  for (const row of await q("select p.prosecdef,p.proconfig,p.proowner::regrole::text owner from pg_proc p where p.proname in ('admin_restaurant_branches','admin_create_branch','admin_update_branch','admin_set_branch_active')")) {
    assert.equal(row.prosecdef,true); assert.equal(row.owner,"postgres"); assert.deepEqual(row.proconfig,['search_path=""']);
  }
  console.log("PASS 009 changes no seed rows, existing policies or table grants; public columns allowlisted; definer RPCs hardened");
  await db.exec(`insert into private.admin_memberships(user_id) values('${admin}');`);
  // Separate concepts are synthetic fixtures, never production/seed records.
  const [parent,other,inactive] = await Promise.all(["Concept A fixture","Concept B fixture","Inactive fixture"].map((name,i) => q("insert into public.restaurants(name,slug,category,is_active) values($1,$2,'restaurant',$3) returning id",[name,`branch-fixture-${i}`,i!==2]).then(rows=>rows[0].id)));
  let id,version;
  await as("authenticated",admin,async () => {
    id = (await q(create,[parent,...fields]))[0].id;
    let row = (await q(read,[parent]))[0]; version=row.version;
    for (const key of ["name","address","phone","google_maps_url","latitude","longitude"]) assert.equal(row[key],null);
    await q(update,[parent,id,version,"Fixture Branch","Fixture Area","Verified fixture address","+92 300 1234567","https://maps.app.goo.gl/fixture",31.5,74.3,true]);
    await fails("40001",update,[parent,id,version,...fields]);
    row=(await q(read,[parent]))[0]; version=row.version;
    assert.equal(row.address,"Verified fixture address"); assert.equal(Number(row.latitude),31.5);
    await fails("P0002",update,[other,id,version,...fields]);
    await fails("P0002",status,[other,id,version,false]);
    await fails("40001",status,[parent,id,null,false]);
    await q(status,[parent,id,version,false]);
    await fails("40001",status,[parent,id,version,true]);
    row=(await q(read,[parent]))[0]; assert.equal(row.is_active,false);
    await fails("23505",create,[parent,"fixture   branch","fixture area","verified fixture address",null,null,null,null,true]);
    await q(status,[parent,id,row.version,true]);
    assert.equal((await q(read,[parent]))[0].is_active,true);
    await q(create,[other,...fields]); // Similar location in a distinct concept stays separate.
    await q(create,[inactive,...fields]);
    await q(create,[parent,null,"Inactive location",null,null,null,null,null,false]);
    const blankId=(await q(create,[parent," \n ","Blank optional fixture","\t "," "," ",null,null,true]))[0].id;
    const blank=(await q(read,[parent])).find(row=>row.id===blankId);
    for(const key of ["name","address","phone","google_maps_url","latitude","longitude"]) assert.equal(blank[key],null);
    for (const pair of [[91,0],[-91,0],[0,181],[0,-181],[1,null],[null,1],["NaN",0],[0,"Infinity"],["-Infinity",0]]) await fails("22023",create,[parent,null,"Invalid coordinates",null,null,null,...pair,true]);
    for(const url of ["javascript:alert(1)","data:text/html,bad","http://google.com/maps/abc","https://evil.example/maps","https://google.com.evil/maps","https://u:p@google.com/maps","https://google.com/maps\\bad"]) await fails("22023",create,[parent,null,"Unsafe URL",null,null,url,null,null,true]);
    await fails("22023",create,[parent,null,null,null,null,null,null,null,true]);
    await fails("P0002",create,[member,...fields]);
  });
  console.log("PASS admin create/edit/deactivate/reactivate; nulls; coordinate pairs/ranges/non-finite values; URL validation; duplicate protection; exact versions; immutable relationships");
  for(const [role,sub] of [["anon",null],["authenticated",member],["authenticated",null]]) await as(role,sub,async()=>{
    await fails("42501",read,[parent]);
    await fails("42501",create,[parent,...fields]);
    await fails("42501",update,[parent,id,version,...fields]);
    await fails("42501",status,[parent,id,version,false]);
    await fails("42501","update public.restaurant_branches set is_active=false");
    await fails("42501","delete from public.restaurant_branches");
    await fails("42501","insert into public.restaurant_branches(restaurant_id) values($1)",[parent]);
    await fails("42501","select * from public.restaurant_branches");
    for(const col of ["is_active","created_at","updated_at"]) await fails("42501",`select ${col} from public.restaurant_branches`);
    for(const col of ["personal_notes","is_favorite"]) await fails("42501",`select ${col} from public.restaurants`);
    const visible=await q(`select ${projection} from public.restaurant_branches where restaurant_id=$1`,[parent]);
    assert.equal(visible.length,2); assert.ok(visible.some(row=>row.id===id));
    assert.deepEqual(await q(`select ${projection} from public.restaurant_branches where restaurant_id=$1`,[inactive]),[]);
  });
  assert.deepEqual(await q("select * from public.restaurants where id<>all($1::uuid[]) order by id",[[parent,other,inactive]]),originals);
  for(const row of originalBranches) assert.deepEqual((await q("select * from public.restaurant_branches where id=$1",[row.id]))[0],row);
  console.log("PASS anonymous/member RPCs and direct writes denied; only active branches of active parents public; private fields denied; all original 74 restaurants and branches unchanged");
  await as("authenticated",admin,async()=>{
    const trimId=(await q(create,[parent," vividv ","Trim fixture",null,null,null,null,null,false]))[0].id;
    assert.equal((await q(read,[parent])).find(row=>row.id===trimId).name,"vividv");
  });
  const beforeVerification=await q("select * from public.restaurant_branches order by id");
  await db.exec(await readFile(new URL("../supabase/verify_restaurant_branches.sql",import.meta.url),"utf8"));
  assert.deepEqual(await q("select * from public.restaurant_branches order by id"),beforeVerification);
  console.log("PASS post-rollout read-only verification SQL against isolated active/inactive fixtures");
  await db.exec(`create or replace function private.is_admin() returns boolean language plpgsql security definer set search_path='' as $$begin raise exception 'Fixture authorization outage'; end;$$;`);
  await as("authenticated",admin,async()=>{
    for(const [sql,args] of [[read,[parent]],[create,[parent,...fields]],[update,[parent,id,version,...fields]],[status,[parent,id,version,false]]]) await fails("P0001",sql,args);
  });
  assert.deepEqual(await q("select * from public.restaurant_branches order by id"),beforeVerification);
  console.log("PASS authorization helper failures fail closed for every branch RPC, with no writes");
} finally { await db.close(); }
