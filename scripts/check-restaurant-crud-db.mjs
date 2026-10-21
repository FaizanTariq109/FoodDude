// Isolated PostgreSQL only. Never connects to the hosted database.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const admin = "00000000-0000-4000-8000-000000000001", member = "00000000-0000-4000-8000-000000000002";
const q = async (sql, args) => (await db.query(sql, args)).rows;
async function as(role, id, action) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${id ?? ""}',false);`);
  try { return await action(); } finally { await db.exec("reset role"); }
}
const fields = ["Local fixture", "local-fixture", "cafe", "Official", 2, "https://example.com", null, true];
const create = args => q("select public.admin_create_restaurant($1,$2,$3,$4,$5,$6,$7,$8) as id", args ?? fields);
const edit = (id, version, args = fields) => q("select public.admin_update_restaurant($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [id, version, ...args]);
const status = (id, version, active) => q("select public.admin_set_restaurant_active($1,$2,$3)", [id,version,active]);
const rejects = (fn, code) => assert.rejects(fn, { code });
const snapshot = () => q(`select c.relname,c.relacl::text,c.relrowsecurity,
 (select json_agg(p order by p.policyname)::text from pg_policies p where p.schemaname='public' and p.tablename=c.relname) policies,
 (select json_agg(a order by a.attnum)::text from pg_attribute a where a.attrelid=c.oid and a.attnum>0) columns
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname`);
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon,authenticated,service_role;
    alter default privileges in schema public grant all on functions to public,anon,authenticated,service_role;
    create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated,service_role;
    insert into auth.users(id) values ('${admin}'),('${member}');`);
  const folder = new URL("../supabase/migrations/", import.meta.url);
  const files = (await readdir(folder)).filter(n => n.endsWith(".sql")).sort();
  for (const name of files.slice(0,6)) await db.exec(await readFile(new URL(name,folder),"utf8"));
  await db.exec(await readFile(new URL("../supabase/seed.sql",import.meta.url),"utf8"));
  const tables = await snapshot(), originals = await q("select * from public.restaurants order by id");
  assert.equal(originals.length,74);
  const unrelated = async () => {
    const values = {};
    for (const {relname} of tables.filter(t => t.relname !== "restaurants")) values[relname] = await q(`select row_to_json(t)::text as row from public.${relname} t order by row_to_json(t)::text`);
    return values;
  };
  await db.exec(`insert into private.admin_memberships(user_id) values ('${admin}');`);
  const baseline = await unrelated();
  await db.exec(await readFile(new URL(files[6],folder),"utf8"));
  assert.deepEqual(await snapshot(),tables);
  assert.deepEqual(await q("select * from public.restaurants order by id"),originals);
  const funcs = await q("select oid::regprocedure::text signature,prosecdef,proconfig,pg_get_userbyid(proowner) owner from pg_proc where proname in ('admin_create_restaurant','admin_update_restaurant','admin_set_restaurant_active')");
  assert.equal(funcs.length,3);
  for (const f of funcs) {
    assert.equal(f.prosecdef,true); assert.equal(f.owner,"postgres"); assert.ok(f.proconfig.includes('search_path=""'));
    for (const role of ["anon","authenticated","service_role"]) assert.equal((await q("select has_function_privilege($1,$2,'execute') allowed",[role,f.signature]))[0].allowed,role === "authenticated");
  }
  console.log("PASS migration preserves schema/ACL/RLS/data; three fixed-path definer RPCs grant authenticated-only execution");
  for (const [role,id] of [["anon",null],["authenticated",member],["authenticated",null],["service_role",admin]]) await as(role,id,async () => {
    await rejects(() => create(),"42501"); await rejects(() => edit(admin,null),"42501"); await rejects(() => status(admin,null,false),"42501");
  });
  await db.exec(`update auth.users set raw_user_meta_data='{"role":"admin","is_admin":true}' where id='${member}';`);
  await as("authenticated",member,() => rejects(() => create(),"42501"));
  let id;
  await as("authenticated",admin,async () => {
    id = (await create())[0].id;
    await rejects(() => create(),"23505");
    for (const [index,value] of [[0," "],[0,"\t\n"],[0,"x".repeat(201)],[1,"Bad slug"],[1,"x".repeat(201)],[2,"bar"],[3,"x".repeat(2001)],[4,5],[5,"javascript:alert(1)"],[5,"https://user:pass@example.com"],[5,"https://example.com\\evil"],[6,"ftp://example.com"],[7,null]]) {
      const invalid = [...fields]; invalid[index]=value;
      await rejects(() => create(invalid),"22023");
    }
    await rejects(() => edit("bad-id",null),"22P02");
    await rejects(() => edit(member,new Date().toISOString()),"P0002");
    await rejects(() => status(member,null,false),"P0002");
  });
  const read = async () => (await q("select *,updated_at::text version from public.restaurants where id=$1",[id]))[0];
  await db.query("update public.restaurants set personal_notes='Untouched',is_favorite=true where id=$1",[id]);
  let row = await read();
  await as("authenticated",admin,async () => {
    await rejects(() => edit(id,null),"40001");
    const changed = [...fields]; changed[0]="Edited fixture"; changed[1]=originals[0].slug;
    await rejects(() => edit(id,row.version,changed),"23505");
  });
  assert.deepEqual(await read(),row); // Duplicate failure is atomic.
  await as("authenticated",admin,() => edit(id,row.version,["Edited fixture",...fields.slice(1)]));
  const updated = await read();
  assert.equal(updated.name,"Edited fixture"); assert.equal(updated.personal_notes,"Untouched"); assert.equal(updated.is_favorite,true);
  assert.equal(updated.created_at.getTime(),row.created_at.getTime());
  await as("authenticated",admin,async () => {
    await rejects(() => edit(id,row.version),"40001");
    await rejects(() => status(id,row.version,false),"40001");
    await status(id,updated.version,false);
  });
  row = await read(); assert.equal(row.is_active,false);
  await as("anon",null,async () => assert.equal((await q("select id from public.restaurants where id=$1",[id])).length,0));
  await as("authenticated",admin,async () => {
    assert.ok((await q("select id from public.admin_restaurants() where id=$1",[id])).length);
    await status(id,row.version,true);
    await rejects(() => q("update public.restaurants set name='Forbidden' where id=$1",[id]),"42501");
    await rejects(() => q("delete from public.restaurants where id=$1",[id]),"42501");
  });
  await as("anon",null,async () => assert.equal((await q("select id from public.restaurants where id=$1",[id])).length,1));
  assert.deepEqual(await q("select * from public.restaurants where id<>$1 order by id",[id]),originals);
  assert.deepEqual(await unrelated(),baseline);
  console.log("PASS auth denials/spoofing, validation, duplicate atomicity, stable IDs, stale writes, legacy preservation, deactivate/reactivate visibility; original 74 and unrelated data unchanged");
  await db.exec("drop function private.is_admin() cascade");
  await as("authenticated",admin,async () => {
    await assert.rejects(() => create()); await assert.rejects(() => edit(id,row.version)); await assert.rejects(() => status(id,row.version,false));
  });
  console.log("PASS authorization-helper failure fails closed for every mutation");
} finally { await db.close(); }
