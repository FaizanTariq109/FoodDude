// Isolated PostgreSQL execution; no hosted database, credentials, or seed edits.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

if (!process.argv[2]) throw Error("Pass the temporary @electric-sql/pglite/dist/index.js path.");
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const admin = "00000000-0000-4000-8000-000000000001";
const member = "00000000-0000-4000-8000-000000000002";
const query = async sql => (await db.query(sql)).rows;
async function as(role, id, action) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${id ?? ""}', false);`);
  try { await action(); } finally { await db.exec("reset role"); }
}
const denied = sql => assert.rejects(db.query(sql), { code: "42501" });
const snapshot = () => query(`select c.relname, c.relacl::text, c.relrowsecurity,
  (select json_agg(p order by p.policyname)::text from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies,
  (select json_agg(a order by a.attnum)::text from pg_attribute a where a.attrelid=c.oid and a.attnum>0) as columns
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' order by c.relname`);
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to public, anon, authenticated, service_role;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    insert into auth.users(id) values ('${admin}'), ('${member}');`);
  const folder = new URL("../supabase/migrations/", import.meta.url);
  const files = (await readdir(folder)).filter(name => name.endsWith(".sql")).sort();
  for (const name of files.slice(0, 5)) await db.exec(await readFile(new URL(name, folder), "utf8"));
  const before = await snapshot();
  await db.exec(await readFile(new URL(files[5], folder), "utf8"));
  assert.deepEqual(await snapshot(), before);
  console.log("PASS migration 006 preserves every table, column grant, and RLS policy");
  const [definition] = await query(`select p.prosecdef, p.provolatile, p.proconfig,
    pg_get_userbyid(p.proowner) as owner, pg_get_function_identity_arguments(p.oid) as arguments
    from pg_proc p where p.oid='public.admin_restaurants()'::regprocedure`);
  assert.equal(definition.prosecdef, true);
  assert.equal(definition.provolatile, "s");
  assert.equal(definition.owner, "postgres");
  assert.equal(definition.arguments, "");
  assert.ok(definition.proconfig.includes('search_path=""'));
  for (const role of ["anon", "authenticated", "service_role"]) {
    const [privilege] = await query(`select has_function_privilege('${role}', 'public.admin_restaurants()', 'execute') as allowed`);
    assert.equal(privilege.allowed, role === "authenticated");
  }
  console.log("PASS RPC definer ownership, empty search path, no identity arguments, authenticated-only execution");
  await db.exec(await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8"));
  assert.equal((await query("select count(*)::int as n from public.restaurants"))[0].n, 74);
  await db.exec(`insert into private.admin_memberships(user_id) values ('${admin}');
    insert into public.restaurants(name,slug,category,is_active,short_description,personal_notes,is_favorite)
    values ('Inactive fixture','inactive-fixture','cafe',false,'Official fixture','Secret legacy note',true);`);
  await as("authenticated", admin, async () => {
    const rows = await query("select * from public.admin_restaurants()");
    assert.equal(rows.length, 75);
    const inactive = rows.find(row => row.slug === "inactive-fixture");
    assert.equal(inactive.is_active, false);
    assert.equal(inactive.short_description, "Official fixture");
    assert.deepEqual(Object.keys(inactive).sort(), ["id","name","slug","category","short_description","price_level","instagram_url","website_url","is_active","created_at","updated_at"].sort());
    await denied("select * from public.restaurants");
  });
  console.log("PASS admin RPC returns original 74 records plus inactive fixture; legacy fields excluded; no broad table read");
  for (const [role, id] of [["anon", null], ["authenticated", member], ["authenticated", null], ["service_role", admin]]) {
    await as(role, id, async () => { await denied("select * from public.admin_restaurants()"); });
  }
  // A member's self-asserted metadata never changes the DB membership check.
  await db.exec(`update auth.users set raw_user_meta_data='{"role":"admin","is_admin":true}' where id='${member}';`);
  await as("authenticated", member, () => denied("select * from public.admin_restaurants()"));
  console.log("PASS anonymous/member/null identity/service role denied; spoofed admin metadata ignored");
  for (const role of ["anon", "authenticated"]) await as(role, role === "authenticated" ? admin : null, async () => {
    const rows = await query("select id,name,slug,category from public.restaurants");
    assert.equal(rows.length, 74);
    assert.ok(!rows.some(row => row.slug === "inactive-fixture"));
    for (const field of ["short_description", "is_active", "personal_notes", "is_favorite", "website_url"])
      await denied(`select ${field} from public.restaurants`);
  });
  console.log("PASS public reads still expose only active identity records and no additional metadata");
  await db.exec("delete from private.admin_memberships");
  await as("authenticated", admin, () => denied("select * from public.admin_restaurants()"));
  await db.exec("drop function private.is_admin() cascade");
  await as("authenticated", admin, async () => { await assert.rejects(db.query("select * from public.admin_restaurants()")); });
  console.log("PASS revocation and authorization-helper failures fail closed");
} finally { await db.close(); }
