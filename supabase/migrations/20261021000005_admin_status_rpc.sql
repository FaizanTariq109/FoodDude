-- Read-only caller status; no membership or catalogue privileges are changed.
begin;

create function public.current_user_is_admin() returns boolean
language sql stable security invoker set search_path = '' as $$
  select private.is_admin();
$$;
alter function public.current_user_is_admin() owner to postgres;
revoke all on function public.current_user_is_admin()
  from public, anon, authenticated, service_role;
grant execute on function public.current_user_is_admin() to authenticated;

commit;
