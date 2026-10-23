// Real SQL/RLS in isolated PGlite. No hosted requests or credentials.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const alice = "00000000-0000-4000-8000-000000000001", bob = "00000000-0000-4000-8000-000000000002", future = "00000000-0000-4000-8000-000000000003";
const q = async (sql, args) => (await db.query(sql, args)).rows;
const fails = (code, sql, args) => assert.rejects(db.query(sql, args), { code });
async function as(role, sub, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${sub ?? ""}',false)`);
  try { return await fn(); } finally { await db.exec("reset role"); }
}
const snapshot = () => q(`select c.relname,c.relacl::text,c.relrowsecurity,
  (select json_agg(p order by p.policyname)::text from pg_policies p where p.tablename=c.relname) policies
  from pg_class c where c.relnamespace in ('public'::regnamespace,'private'::regnamespace) and c.relkind='r'
  and c.relname <> 'user_lists' order by c.relname`);
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon,authenticated,service_role;
    create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated,service_role;
    insert into auth.users(id) values('${alice}'),('${bob}');`);
  const folder = new URL("../supabase/migrations/", import.meta.url);
  const files = (await readdir(folder)).filter(name => name.endsWith(".sql")).sort();
  for (const name of files.slice(0, 10)) await db.exec(await readFile(new URL(name, folder), "utf8"));
  const [restaurant, hidden] = (await q("insert into public.restaurants(name,slug,category,is_active) values('Visible','visible-test','cafe',true),('Hidden','hidden-test','cafe',false) returning id")).map(row => row.id);
  let custom, customEntry;
  await as("authenticated", alice, async () => {
    custom = (await q("insert into public.user_lists(name,description) values('Liked Places','User-created description') returning id"))[0].id;
    await q("insert into public.user_lists(name) values('Favorites'),('Date Nights')");
    customEntry = (await q("insert into public.user_list_entries(list_id,restaurant_id,notes) values($1,$2,'Preserve this private note') returning id", [custom, restaurant]))[0].id;
  });
  const before = await snapshot(), customBefore = await q("select * from public.user_lists order by id"), entriesBefore = await q("select * from public.user_list_entries order by id");
  await db.exec(await readFile(new URL("20261023000011_liked_places.sql", folder), "utf8"));
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual((await q("select * from public.user_lists where kind='custom' order by id")).map(({ kind, ...row }) => { assert.equal(kind, "custom"); return row; }), customBefore);
  assert.deepEqual(await q("select * from public.user_list_entries order by id"), entriesBefore);
  assert.equal((await q("select id from public.user_lists where kind='liked'")).length, 2);
  assert.equal((await q("select e.id from public.user_list_entries e join public.user_lists l on l.id=e.list_id where l.kind='liked'")).length, 0);
  console.log("PASS 011 preserves custom lists (including same display name), IDs, descriptions, notes, memberships and unrelated ACL/RLS; backfill creates exactly one empty special list per existing profile");
  await q("insert into auth.users(id) values($1)", [future]);
  assert.equal((await q("select id from public.user_lists where owner_id=$1 and kind='liked'", [future])).length, 1);
  const liked = (await q("select id from public.user_lists where owner_id=$1 and kind='liked'", [alice]))[0].id;
  await fails("23505", "insert into public.user_lists(owner_id,name,kind) values($1,'Liked Places','liked')", [alice]);
  await fails("23514", "update public.user_lists set name='Renamed' where id=$1", [liked]);
  await as("authenticated", alice, async () => {
    assert.deepEqual(await q("update public.user_lists set name='Renamed' where id=$1 returning id", [liked]), []);
    assert.deepEqual(await q("update public.user_lists set description='Changed' where id=$1 returning id", [liked]), []);
    assert.deepEqual(await q("delete from public.user_lists where id=$1 returning id", [liked]), []);
    await fails("42501", "update public.user_lists set kind='custom' where id=$1", [liked]);
    await fails("42501", "insert into public.user_lists(name,kind) values('Liked Places','liked')");
    await fails("42501", "insert into public.user_lists(owner_id,name) values($1,'Spoof')", [bob]);
    await q("update public.user_lists set name='My custom liked places' where id=$1", [custom]);
  });
  console.log("PASS future signup initialization, database uniqueness, protected default name/description/deletion, immutable discriminator and owner; custom list editing remains available");
  await as("authenticated", alice, async () => {
    await Promise.all(Array.from({ length: 12 }, () => q("select public.set_restaurant_liked($1,true)", [restaurant])));
    assert.equal((await q("select * from public.user_list_entries where list_id=$1", [liked])).length, 1);
    await q("update public.user_list_entries set notes='Private favorite note' where list_id=$1", [liked]);
    await q("select public.set_restaurant_liked($1,true)", [restaurant]);
    assert.equal((await q("select notes from public.user_list_entries where list_id=$1", [liked]))[0].notes, "Private favorite note");
    await fails("23505", "insert into public.user_list_entries(list_id,restaurant_id) values($1,$2)", [liked, restaurant]);
    await fails("42501", "select public.set_restaurant_liked($1,true)", [hidden]);
    await fails("42501", "select public.set_restaurant_liked($1,true)", [bob]);
    await fails("22023", "select public.set_restaurant_liked(null,true)");
    await fails("22023", "select public.set_restaurant_liked($1,null)", [restaurant]);
  });
  await as("authenticated", bob, async () => {
    assert.deepEqual(await q("select id from public.user_lists where id=$1", [liked]), []);
    assert.deepEqual(await q("select notes from public.user_list_entries where list_id=$1", [liked]), []);
    await fails("42501", "insert into public.user_list_entries(list_id,restaurant_id) values($1,$2)", [liked, restaurant]);
    assert.deepEqual(await q("delete from public.user_list_entries where list_id=$1 returning id", [liked]), []);
    await q("select public.set_restaurant_liked($1,false)", [restaurant]);
  });
  await q("insert into private.admin_memberships(user_id) values($1)", [bob]);
  await as("authenticated", bob, async () => assert.deepEqual(await q("select notes from public.user_list_entries where list_id=$1", [liked]), []));
  for (const role of ["anon", "service_role"]) await as(role, null, async () => {
    await fails("42501", "select public.set_restaurant_liked($1,true)", [restaurant]);
    await fails("42501", "select * from public.user_lists");
    await fails("42501", "select * from public.user_list_entries");
  });
  await as("authenticated", null, async () => {
    assert.deepEqual(await q("select * from public.user_lists"), []);
    await fails("42501", "select public.set_restaurant_liked($1,true)", [restaurant]);
  });
  console.log("PASS idempotent repeated/concurrently dispatched like requests, membership uniqueness, private notes preserved on repeated likes, two-user/admin isolation, denied anonymous/null/service execution and invalid/hidden additions");
  await q("update public.restaurants set is_active=false where id=$1", [restaurant]);
  await as("authenticated", alice, async () => {
    assert.deepEqual(await q("select id,name from public.restaurants where id=$1", [restaurant]), []);
    assert.equal((await q("select notes from public.user_list_entries where list_id=$1", [liked]))[0].notes, "Private favorite note");
    await q("select public.set_restaurant_liked($1,true)", [restaurant]);
    await Promise.all(Array.from({ length: 8 }, () => q("select public.set_restaurant_liked($1,false)", [restaurant])));
    assert.deepEqual(await q("select id from public.user_list_entries where list_id=$1", [liked]), []);
    assert.equal((await q("select notes from public.user_list_entries where id=$1", [customEntry]))[0].notes, "Preserve this private note");
    await fails("42501", "select public.set_restaurant_liked($1,true)", [restaurant]);
  });
  await q("update public.restaurants set is_active=true where id=$1", [restaurant]);
  await as("authenticated", alice, async () => { await q("select public.set_restaurant_liked($1,true)", [restaurant]); });
  await as("authenticated", alice, async () => assert.equal((await q("select restaurant_id from public.user_list_entries where list_id=$1", [liked]))[0].restaurant_id, restaurant));
  const functions = await q("select proname,prosecdef,proconfig from pg_proc where oid in ('private.initialize_liked_places()'::regprocedure,'public.set_restaurant_liked(uuid,boolean)'::regprocedure) order by proname");
  assert.equal(functions[0].prosecdef, true); assert.equal(functions[1].prosecdef, false);
  for (const fn of functions) assert.ok(fn.proconfig.some(config => config.startsWith("search_path=")));
  for (const role of ["anon", "authenticated", "service_role"]) assert.equal((await q("select has_function_privilege($1,'private.initialize_liked_places()','EXECUTE') allowed", [role]))[0].allowed, false);
  await q("delete from auth.users where id=$1", [future]);
  assert.deepEqual(await q("select id from public.user_lists where owner_id=$1", [future]), []);
  console.log("PASS deactivated references/notes remain private, unlike touches only default membership, re-like inactive denied, cross-session persisted reads, hardened trigger-only definer/invoker RPC and account cascade");
} finally { await db.close(); }
