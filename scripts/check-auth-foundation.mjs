// Offline PostgreSQL execution with simulated Supabase roles/Auth identity.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
if (!process.argv[2]) throw Error("Pass a temporary @electric-sql/pglite/dist/index.js path; see docs/auth-foundation.md.");
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
const charlie = "00000000-0000-4000-8000-000000000003";
const query = async sql => (await db.query(sql)).rows;
let passed = 0;
async function as(role, id, action) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${id ?? ""}', false);`);
  try { await action(); } finally { await db.exec("reset role;"); }
}
async function denied(sql) { await assert.rejects(db.query(sql), { code: "42501" }); }
async function check(name, action) { await action(); passed++; console.log(`PASS ${name}`); }
async function snapshot() {
  return query(`select c.relname, c.relrowsecurity, c.relacl::text,
    (select json_agg(p order by p.policyname) from pg_policies p
      where p.schemaname = 'public' and p.tablename = c.relname)::text as policies
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'profiles' order by c.relname`);
}
try {
  // Deliberately permissive defaults catch accidental inherited API access.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to public, anon, authenticated, service_role;
    create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    insert into auth.users(id) values ('${alice}');`);
  for (const name of ["20261020000001_initial_schema.sql", "20261020000002_enable_rls.sql", "20261020000003_public_restaurant_read.sql"]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
  }
  const before = await snapshot();
  await db.exec(await readFile(new URL("../supabase/migrations/20261021000004_profiles_and_admins.sql", import.meta.url), "utf8"));
  await check("14 existing tables, ACLs and policies unchanged", async () => {
    assert.equal(before.length, 14); assert.deepEqual(await snapshot(), before);
  });
  await check("backfill and signup create ordinary profiles without trusting metadata", async () => {
    assert.equal((await query("select * from public.profiles")).length, 1);
    await db.exec(`insert into auth.users values ('${bob}', '{"is_admin":true,"role":"admin","display_name":"Admin"}');`);
    assert.equal((await query(`select display_name from public.profiles where id = '${bob}'`))[0].display_name, "FoodDude member");
    assert.equal((await query("select * from private.admin_memberships")).length, 0);
  });
  await check("owner reads/edits only their profile; timestamp maintained", async () => {
    await as("authenticated", alice, async () => {
      assert.deepEqual((await query("select id from public.profiles")).map(r => r.id), [alice]);
      const old = (await query("select updated_at from public.profiles"))[0].updated_at;
      assert.equal((await query("update public.profiles set display_name = 'Alice', avatar_path = 'avatars/alice.jpg' returning id")).length, 1);
      assert.ok(new Date((await query("select updated_at from public.profiles"))[0].updated_at) >= new Date(old));
      assert.equal((await query(`update public.profiles set display_name = 'Stolen' where id = '${bob}' returning id`)).length, 0);
    });
    assert.equal((await query(`select display_name from public.profiles where id = '${bob}'`))[0].display_name, "FoodDude member");
  });
  await check("anonymous has no profile access or admin helper", async () => {
    await as("anon", null, async () => {
      for (const sql of ["select id from public.profiles", "update public.profiles set display_name = 'X'", `insert into public.profiles(id) values ('${charlie}')`, "delete from public.profiles", "select private.is_admin()"] ) await denied(sql);
    });
  });
  await check("only explicitly permitted profile columns; no user insert/delete/truncate", async () => {
    assert.equal((await query("select has_table_privilege('authenticated', 'public.profiles', 'SELECT,UPDATE') as allowed"))[0].allowed, false);
    await as("authenticated", alice, async () => {
      for (const sql of [`update public.profiles set id = '${bob}'`, "update public.profiles set created_at = now()", "update public.profiles set updated_at = now()", `insert into public.profiles(id) values ('${charlie}')`, "delete from public.profiles", "truncate public.profiles"]) await denied(sql);
    });
    assert.deepEqual((await query("select column_name from information_schema.columns where table_schema='public' and table_name='profiles' order by ordinal_position")).map(r => r.column_name), ["id", "display_name", "avatar_path", "created_at", "updated_at"]);
  });
  await check("null identity sees/updates nothing", async () => {
    await as("authenticated", null, async () => {
      assert.equal((await query("select id from public.profiles")).length, 0);
      assert.equal((await query("update public.profiles set display_name='X' returning id")).length, 0);
      assert.equal((await query("select private.is_admin() as admin"))[0].admin, false);
    });
  });
  await check("admin self-assignment and membership exposure denied for all API roles", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) await as(role, bob, async () => {
      for (const sql of ["select * from private.admin_memberships", `insert into private.admin_memberships(user_id) values ('${bob}')`, `update private.admin_memberships set user_id='${bob}'`, "delete from private.admin_memberships", "truncate private.admin_memberships", "select private.create_user_profile()", "create function private.evil() returns int language sql as 'select 1'"]) await denied(sql);
    });
  });
  await check("privileged-only assignment; helper reflects assignment and revocation; admin remains a normal profile owner", async () => {
    await db.exec(`insert into private.admin_memberships(user_id) values ('${alice}');`);
    await as("authenticated", alice, async () => {
      assert.equal((await query("select private.is_admin() as admin"))[0].admin, true);
      assert.deepEqual((await query("select id from public.profiles")).map(r => r.id), [alice]);
      assert.equal((await query(`update public.profiles set display_name='X' where id='${bob}' returning id`)).length, 0);
    });
    await as("authenticated", bob, async () => assert.equal((await query("select private.is_admin() as admin"))[0].admin, false));
    await db.exec("delete from private.admin_memberships;");
    await as("authenticated", alice, async () => assert.equal((await query("select private.is_admin() as admin"))[0].admin, false));
  });
  await check("constraints and account deletion cascade", async () => {
    for (const sql of ["update public.profiles set display_name='   '", "update public.profiles set display_name=repeat('x',81)", "update public.profiles set avatar_path=' '", "update public.profiles set avatar_path=repeat('x',1025)"]) await assert.rejects(db.exec(sql), { code: "23514" });
    await assert.rejects(db.exec(`insert into public.profiles(id) values ('${charlie}')`), { code: "23503" });
    await db.exec(`insert into private.admin_memberships(user_id) values ('${bob}'); delete from auth.users where id='${bob}';`);
    assert.equal((await query(`select id from public.profiles where id='${bob}'`)).length, 0);
    assert.equal((await query("select * from private.admin_memberships")).length, 0);
  });
  await check("hardened helper ownership/search path and no membership policies", async () => {
    const functions = await query("select p.proname, p.prosecdef, p.proconfig, r.rolname from pg_proc p join pg_namespace n on p.pronamespace=n.oid join pg_roles r on r.oid=p.proowner where n.nspname='private'");
    assert.equal(functions.length, 2);
    assert.ok(functions.every(f => f.prosecdef && f.rolname === "postgres" && f.proconfig.includes('search_path=""')));
    assert.equal((await query("select * from pg_policies where schemaname='private'")).length, 0);
    assert.equal((await query("select relrowsecurity from pg_class where oid='private.admin_memberships'::regclass"))[0].relrowsecurity, true);
    const config = await readFile(new URL("../supabase/config.toml", import.meta.url), "utf8");
    assert.match(config, /schemas = \["public", "graphql_public"\]/);
  });
  console.log(`All ${passed} offline auth foundation checks passed. No live database used.`);
} finally { await db.close(); }
