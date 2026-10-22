-- Read-only metadata inspection. Does not read any user's lists or notes.
begin read only;
select jsonb_build_object(
  'tables', (select jsonb_agg(jsonb_build_object(
    'name', c.relname, 'owner', pg_get_userbyid(c.relowner), 'rls', c.relrowsecurity
  ) order by c.relname) from pg_class c
    where c.relnamespace='public'::regnamespace and c.relname in ('user_lists','user_list_entries')),
  'policies', (select jsonb_agg(to_jsonb(p) order by tablename,policyname)
    from pg_policies p where schemaname='public' and tablename in ('user_lists','user_list_entries')),
  'columns', (select jsonb_agg(jsonb_build_object(
    'role', roles.name, 'table', c.relname, 'column', a.attname,
    'select', has_column_privilege(roles.name,c.oid,a.attnum,'SELECT'),
    'insert', has_column_privilege(roles.name,c.oid,a.attnum,'INSERT'),
    'update', has_column_privilege(roles.name,c.oid,a.attnum,'UPDATE')
  ) order by roles.name,c.relname,a.attnum)
    from pg_class c join pg_attribute a on a.attrelid=c.oid
    cross join (values ('anon'),('authenticated')) roles(name)
    where c.relnamespace='public'::regnamespace and c.relname in ('user_lists','user_list_entries')
      and a.attnum>0 and not a.attisdropped),
  'table_privileges', (select jsonb_agg(jsonb_build_object(
    'role', roles.name, 'table', tables.name,
    'delete', has_table_privilege(roles.name,'public.'||tables.name,'DELETE'),
    'truncate', has_table_privilege(roles.name,'public.'||tables.name,'TRUNCATE'),
    'references', has_table_privilege(roles.name,'public.'||tables.name,'REFERENCES'),
    'trigger', has_table_privilege(roles.name,'public.'||tables.name,'TRIGGER')
  ) order by roles.name,tables.name)
    from (values ('anon'),('authenticated')) roles(name)
    cross join (values ('user_lists'),('user_list_entries')) tables(name)),
  'roles', (select jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'bypass_rls',rolbypassrls)
    order by rolname) from pg_roles where rolname in ('anon','authenticated')),
  'constraints', (select jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,
    'name',conname,'definition',pg_get_constraintdef(oid)) order by conname)
    from pg_constraint where conrelid in ('public.user_lists'::regclass,'public.user_list_entries'::regclass))
) as private_lists_security;
rollback;
