// Isolated PostgreSQL only. Never connects to or changes hosted records.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
if (!process.argv[2]) throw Error("Pass a temporary @electric-sql/pglite/dist/index.js path.");
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const admin = "00000000-0000-4000-8000-000000000001", member = "00000000-0000-4000-8000-000000000002";
const query = async (sql, args) => (await db.query(sql, args)).rows;
async function as(role, id, action) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${id ?? ""}', false);`);
  try { return await action(); } finally { await db.exec("reset role"); }
}
const denied = (sql, args) => assert.rejects(db.query(sql, args), { code: "42501" });
const policies = () => query("select * from pg_policies where schemaname in ('public','private') order by schemaname,tablename,policyname");
const tables = () => query(`select c.relname,c.relacl::text,c.relrowsecurity from pg_class c
  join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' order by n.nspname,c.relname`);
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon,authenticated,service_role;
    create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated,service_role;
    insert into auth.users(id) values ('${admin}'),('${member}');`);
  const folder = new URL("../supabase/migrations/", import.meta.url);
  const files = (await readdir(folder)).filter(name => name.endsWith(".sql")).sort();
  for (const name of files.slice(0,7)) await db.exec(await readFile(new URL(name,folder),"utf8"));
  await db.exec(await readFile(new URL("../supabase/seed.sql", import.meta.url),"utf8"));
  const originalRows = await query("select * from public.restaurants order by id");
  const originalPolicies = await policies(), originalTables = await tables();
  await db.exec(await readFile(new URL("20261021000008_public_restaurant_metadata.sql",folder),"utf8"));
  assert.deepEqual(await query("select * from public.restaurants order by id"),originalRows);
  assert.deepEqual(await policies(),originalPolicies);
  assert.deepEqual(await tables(),originalTables);
  const approved = new Set(["id","name","slug","category","short_description","price_level","website_url","instagram_url"]);
  for (const role of ["anon","authenticated"]) {
    assert.equal((await query(`select has_table_privilege($1,'public.restaurants','SELECT') allowed`,[role]))[0].allowed,false);
    const cols = await query("select attname from pg_attribute where attrelid='public.restaurants'::regclass and attnum>0 and not attisdropped");
    for (const {attname} of cols) {
      assert.equal((await query("select has_column_privilege($1,'public.restaurants',$2,'SELECT') allowed",[role,attname]))[0].allowed,approved.has(attname), `${role}.${attname}`);
      assert.equal((await query("select has_column_privilege($1,'public.restaurants',$2,'INSERT,UPDATE,REFERENCES') allowed",[role,attname]))[0].allowed,false);
    }
  }
  console.log("PASS migration 008 preserves all 74 seed rows, RLS policies, table grants; only eight public columns readable; no writes granted");
  await db.exec(`insert into private.admin_memberships(user_id) values ('${admin}');`);
  let id;
  await as("authenticated",admin,async () => {
    id = (await query("select public.admin_create_restaurant('Metadata fixture','metadata-fixture','cafe',null,null,null,null,true) id"))[0].id;
    const version = (await query("select updated_at::text version from public.admin_restaurants() where id=$1",[id]))[0].version;
    await query("select public.admin_update_restaurant($1,$2,'Metadata fixture','metadata-fixture','cafe','Edited official description',3,'https://example.com','https://instagram.com/example',true)",[id,version]);
  });
  const projection = "id,name,slug,category,short_description,price_level,website_url,instagram_url";
  for (const [role,sub] of [["anon",null],["authenticated",member]]) await as(role,sub,async () => {
    const row = (await query(`select ${projection} from public.restaurants where id=$1`,[id]))[0];
    assert.equal(row.short_description,"Edited official description"); assert.equal(row.price_level,3);
    assert.equal(row.website_url,"https://example.com"); assert.equal(row.instagram_url,"https://instagram.com/example");
    for (const col of ["personal_notes","is_favorite","is_active","created_at","updated_at"]) await denied(`select ${col} from public.restaurants`);
    await denied("select * from public.restaurants");
    await denied("update public.restaurants set short_description='Forbidden'");
    await denied("select * from public.restaurant_branches");
  });
  console.log("PASS anon/member read administrator-edited official fields while personal/status/timestamp fields and unrelated catalogue tables stay restricted");
  await as("authenticated",admin,async () => {
    const version = (await query("select updated_at::text version from public.admin_restaurants() where id=$1",[id]))[0].version;
    await query("select public.admin_set_restaurant_active($1,$2,false)",[id,version]);
  });
  for (const [role,sub] of [["anon",null],["authenticated",member]]) await as(role,sub,async () => {
    assert.deepEqual(await query(`select ${projection} from public.restaurants where id=$1`,[id]),[]);
    assert.equal((await query(`select ${projection} from public.restaurants`)).length,74);
  });
  assert.deepEqual(await query("select * from public.restaurants where id<>$1 order by id",[id]),originalRows);
  console.log("PASS inactive metadata is invisible to both API roles; original 74 records unchanged after isolated fixture tests");
} finally { await db.close(); }
