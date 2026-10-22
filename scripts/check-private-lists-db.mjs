// Isolated PostgreSQL with real RLS/grants. No hosted writes or credentials.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const alice='00000000-0000-4000-8000-000000000001', bob='00000000-0000-4000-8000-000000000002';
const q = async (sql,args) => (await db.query(sql,args)).rows;
const fails = (code,sql,args) => assert.rejects(db.query(sql,args),{code});
async function as(role,sub,fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${sub ?? ''}',false)`);
  try { return await fn(); } finally { await db.exec('reset role'); }
}
const snapshot = () => q(`select c.relname,c.relacl::text,c.relrowsecurity,
  (select json_agg(p order by p.policyname)::text from pg_policies p where p.tablename=c.relname) policies
  from pg_class c where c.relnamespace in ('public'::regnamespace,'private'::regnamespace) and c.relkind='r'
  and c.relname not in ('user_lists','user_list_entries') order by c.relname`);
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to public,anon,authenticated,service_role;
    create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated,service_role;
    insert into auth.users(id) values('${alice}'),('${bob}');`);
  const folder=new URL('../supabase/migrations/',import.meta.url);
  const files=(await readdir(folder)).filter(n=>n.endsWith('.sql')).sort();
  for(const name of files.slice(0,9)) await db.exec(await readFile(new URL(name,folder),'utf8'));
  const before=await snapshot();
  await db.exec(await readFile(new URL(files[9],folder),'utf8'));
  assert.deepEqual(await snapshot(),before);
  assert.deepEqual(await q('select * from public.user_lists'),[]);
  console.log('PASS additive 010: existing ACLs/RLS unchanged, no automatic lists, permissive defaults revoked');
  const [r,hidden]=(await q("insert into public.restaurants(name,slug,category,is_active) values('Public fixture','public-fixture','cafe',true),('Secret draft','secret-fixture','cafe',false) returning id")).map(x=>x.id);
  let a,b,entry,second;
  await as('authenticated',alice,async()=>{
    a=(await q("insert into public.user_lists(name) values('Favorites') returning id"))[0].id;
    second=(await q("insert into public.user_lists(name,description) values('Date Nights','Private plans') returning id"))[0].id;
    entry=(await q('insert into public.user_list_entries(list_id,restaurant_id,notes) values($1,$2,$3) returning id',[a,r,'Only Alice']))[0].id;
    await q('insert into public.user_list_entries(list_id,restaurant_id) values($1,$2)',[second,r]);
    await fails('23505','insert into public.user_list_entries(list_id,restaurant_id) values($1,$2)',[a,r]);
    await fails('42501','insert into public.user_list_entries(list_id,restaurant_id) values($1,$2)',[a,hidden]);
    await fails('42501','insert into public.user_list_entries(list_id,restaurant_id) values($1,$2)',[a,bob]);
    await fails('42501',"insert into public.user_lists(owner_id,name) values($1,'Spoof')",[bob]);
    await fails('42501','update public.user_lists set owner_id=$1 where id=$2',[bob,a]);
    await fails('42501','update public.user_lists set id=$1 where id=$2',[bob,a]);
    await fails('42501','update public.user_list_entries set created_at=now() where id=$1',[entry]);
    await fails('42501','update public.user_list_entries set list_id=$1 where id=$2',[second,entry]);
    await fails('42501','update public.user_list_entries set restaurant_id=$1 where id=$2',[hidden,entry]);
    await fails('23514',"insert into public.user_lists(name) values('   ')");
    await fails('23514',"insert into public.user_lists(name) values(repeat('x',81))");
    await fails('23514',"update public.user_lists set description=repeat('x',1001) where id=$1",[a]);
    await fails('23514',"update public.user_list_entries set notes=repeat('x',5001) where id=$1",[entry]);
    await q("update public.user_lists set name='Dinner',description='Updated' where id=$1",[a]);
    await q("update public.user_list_entries set notes='Edited private note' where id=$1",[entry]);
  });
  await as('authenticated',bob,async()=>{
    b=(await q("insert into public.user_lists(name) values('Bob private') returning id"))[0].id;
    assert.deepEqual(await q('select id from public.user_lists where id=$1',[a]),[]);
    assert.deepEqual(await q('select notes from public.user_list_entries where id=$1',[entry]),[]);
    assert.deepEqual(await q("update public.user_lists set name='Hijack' where id=$1 returning id",[a]),[]);
    assert.deepEqual(await q('delete from public.user_lists where id=$1 returning id',[a]),[]);
    assert.deepEqual(await q("update public.user_list_entries set notes='Hijack' where id=$1 returning id",[entry]),[]);
    assert.deepEqual(await q('delete from public.user_list_entries where id=$1 returning id',[entry]),[]);
    await fails('42501','insert into public.user_list_entries(list_id,restaurant_id) values($1,$2)',[a,r]);
    await fails('42501','update public.user_list_entries set list_id=$1 where id=$2',[b,entry]);
    await fails('42501','insert into public.user_list_entries(list_id,restaurant_id) values($1,$2)',[alice,r]);
  });
  await as('authenticated',alice,async()=>assert.deepEqual(await q('select id from public.user_lists where id=$1',[b]),[]));
  console.log('PASS two-user isolation in both directions, owner spoofing/reparenting denied, CRUD, multiple lists, duplicate/length constraints');
  for(const [role,sub] of [['anon',null],['authenticated',null]]) await as(role,sub,async()=>{
    if(role==='anon') {
      for(const table of ['user_lists','user_list_entries']) {
        await fails('42501',`select * from public.${table}`);
        await fails('42501',`delete from public.${table}`);
      }
      await fails('42501',"update public.user_lists set name='Anonymous'");
      await fails('42501',"update public.user_list_entries set notes='Anonymous'");
    } else {
      assert.deepEqual(await q('select * from public.user_lists'),[]);
      assert.deepEqual(await q('select * from public.user_list_entries'),[]);
      assert.deepEqual(await q("update public.user_lists set name='Anonymous' returning id"),[]);
      assert.deepEqual(await q('delete from public.user_lists returning id'),[]);
    }
    await fails('42501',"insert into public.user_lists(name) values('Anonymous')");
    await fails('42501','insert into public.user_list_entries(list_id,restaurant_id) values($1,$2)',[a,r]);
  });
  await db.query('update public.restaurants set is_active=false where id=$1',[r]);
  // Existing authorization and catalogue boundaries still hold after migration 010.
  await as('authenticated',bob,async()=>{
    await fails('42501','select * from public.admin_restaurants()');
    await fails('42501',"update public.restaurants set name='Hijack'");
    await fails('42501','select personal_notes from public.restaurants');
  });
  await db.query('insert into private.admin_memberships(user_id) values($1)',[bob]);
  await as('authenticated',bob,async()=>{
    assert.equal((await q('select id from public.admin_restaurants() where id=$1',[hidden])).length,1);
    assert.deepEqual(await q('select id from public.user_lists where id=$1',[a]),[]);
    assert.deepEqual(await q('select notes from public.user_list_entries where id=$1',[entry]),[]);
    assert.deepEqual(await q('select id,name from public.restaurants where id=$1',[hidden]),[]);
  });
  await as('authenticated',alice,async()=>{
    assert.equal((await q('select notes from public.user_list_entries where id=$1',[entry]))[0].notes,'Edited private note');
    assert.deepEqual(await q('select id,name,slug from public.restaurants where id=$1',[r]),[]);
    await q('delete from public.user_list_entries where list_id=$1',[second]);
    await fails('42501','insert into public.user_list_entries(list_id,restaurant_id) values($1,$2)',[second,r]);
    await q("update public.user_list_entries set notes='Still editable' where id=$1",[entry]);
  });
  await fails('23001','delete from public.restaurants where id=$1',[r]);
  console.log('PASS anonymous reads/writes denied, hidden/draft/deactivated additions denied, saved references/notes preserved without catalogue leaks');
  await as('authenticated',alice,async()=>{
    assert.equal((await q('select name,description from public.user_lists where id=$1',[a]))[0].name,'Dinner');
    assert.deepEqual(await q('select id from public.user_lists where id=$1',[alice]),[]);
    await q('delete from public.user_lists');
    assert.deepEqual(await q('select * from public.user_lists'),[]);
    assert.deepEqual(await q('select * from public.user_list_entries'),[]);
  });
  assert.equal((await q('select count(*)::int n from public.user_lists'))[0].n,1);
  await q('delete from auth.users where id=$1',[bob]);
  assert.deepEqual(await q('select * from public.user_lists'),[]);
  console.log('PASS persisted edits across sessions, nonexistent IDs, list cascade, zero lists, account cascade');
} finally { await db.close(); }
