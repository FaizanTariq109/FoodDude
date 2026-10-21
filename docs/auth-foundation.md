# Authentication database foundation — Step 5A

Migration `20261021000004_profiles_and_admins.sql` follows migrations 001–003.
It has not been applied remotely. The existing 14 tables, catalogue grants and
policies are unchanged. There is no signup/login UI, storage, personal-list,
private-restaurant, review or admin CRUD implementation in this step.

## Profiles

`public.profiles.id` is both the primary key and an `auth.users.id` foreign key
with deletion cascade. Every existing Auth account receives a profile; an
`auth.users` insert trigger creates one for subsequent accounts. The default
display name is `FoodDude member`; no email or user metadata is copied.

Display names are required, nonblank and limited to 80 characters. Optional
avatar paths are nonblank when present and limited to 1,024 characters. This is
only a path field; it neither creates storage nor authorizes access to files.
`created_at` and `updated_at` are required timestamps; updates use the existing
timestamp-maintenance trigger function.

Authenticated users can select their own five profile columns and update only
`display_name` and `avatar_path`. RLS checks both the existing and resulting row
against `auth.uid()`. Users cannot change identity/timestamps, insert, delete,
truncate or access another profile. The `anon` role has no privileges. There is
no role/admin column. A missing/null Auth identity cannot access rows. Admins
have the same personal-profile restrictions as other authenticated users.

Profile creation runs in a trigger-only `SECURITY DEFINER` function owned by
`postgres`, with an empty search path and fully qualified table references.
Its EXECUTE privilege is revoked from PUBLIC and every API role. Profile
creation failures will fail the Auth user insert transaction; verify this
behavior on local Supabase before enabling signup in a later step.

## Administrator authorization

`private.admin_memberships` stores only Auth user UUIDs and creation timestamps.
Account deletion removes membership. The `private` schema is absent from the
configured API schemas; keep it unexposed in hosted Supabase as well. Membership
RLS has no client policies, and all table privileges are revoked from PUBLIC,
`anon`, `authenticated` and `service_role`. No membership mutation RPC exists.
Only the trusted database owner/operator can assign or revoke membership.

`private.is_admin()` is a STABLE, `SECURITY DEFINER`, `postgres`-owned boolean
helper with an empty search path. It checks only `auth.uid()` against membership;
it accepts no arbitrary user ID. Authenticated callers get schema USAGE and
EXECUTE on this helper, without schema CREATE or membership-table access.
Anonymous callers cannot execute it. New functions must have their grants
reviewed explicitly; default PostgreSQL PUBLIC EXECUTE is not safe by itself.

Future RLS policies can use `(select private.is_admin())`. Future server-side
code must evaluate it with a verified, user-scoped Auth identity over a trusted
database path. A browser-supplied UUID, email, `user_metadata` role, or header is
not authorization. The private function is intentionally not a Data API RPC;
no public wrapper is introduced here. Existing catalogue permissions do not yet
give admins extra write access. Membership revocation is read from the database
on subsequent statements rather than relying on a role cached in a JWT.

## Assign the first administrator later

Do not put an administrator UUID, email, secret or membership insert in a
migration or application seed. After this migration is separately approved and
applied, create an ordinary authenticated account using the normal Auth flow.
Verify that the intended person controls the account and has completed account
verification. Obtain the exact UUID from the trusted Supabase Authentication
Users dashboard. Email can help an operator locate the account, but membership
must reference that verified UUID, never a client-supplied email or metadata.

As a trusted project owner, use the Supabase SQL Editor (database `postgres`
role) or a secure owner database connection. Replace the placeholder below
with the verified UUID, review it, and execute manually. This example requires
email or phone verification; it deliberately fails for an unverified account.
Do not run it from a browser, Data API request or application service key.

```sql
begin;
do $$
declare
  target_user uuid := 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID';
begin
  if not exists (
    select 1 from auth.users
    where id = target_user
      and (email_confirmed_at is not null or phone_confirmed_at is not null)
  ) then
    raise exception 'Verified Auth account not found; stop and verify the UUID';
  end if;
  insert into private.admin_memberships (user_id) values (target_user)
    on conflict (user_id) do nothing;
end;
$$;
commit;
```

Confirm the row as the owner, then confirm `private.is_admin()` under the real
user's authenticated context when that integration is implemented. Calling it
as `postgres` without an Auth identity returns false. Keep operator assignment
and revocation records in the privileged operational audit trail. To revoke,
the same trusted operator executes:

```sql
delete from private.admin_memberships
where user_id = 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID'::uuid;
```

## Offline verification

The test uses temporary in-memory PostgreSQL via PGlite, applies all four
migrations, models permissive default grants, and simulates `anon`,
`authenticated`, `service_role` and `auth.uid()`. No real Auth account, remote
database or application dependency is involved.

```powershell
npm install --prefix "$env:TEMP\fooddude-schema-check" --no-save --package-lock=false @electric-sql/pglite
node scripts/check-schema.mjs "$env:TEMP\fooddude-schema-check\node_modules\@electric-sql\pglite\dist\index.js"
node scripts/check-auth-foundation.mjs "$env:TEMP\fooddude-schema-check\node_modules\@electric-sql\pglite\dist\index.js"
npm run lint
npm run typecheck
```

Coverage includes ownership, anon/null-identity denial, column permissions,
unauthorized updates/inserts/deletes, admin self-assignment, private-schema
access, privileged assignment/revocation, metadata spoofing, constraints,
cascades, and preservation of the 14 original tables' ACLs and policies.
The existing schema suite independently covers migrations 001–003. These tests
do not validate hosted API schema exposure, JWT verification or the actual Auth
service; local Supabase integration checks are still needed before rollout.

Design references: [Supabase user data](https://supabase.com/docs/guides/auth/managing-user-data)
and [RLS/private authorization helpers](https://supabase.com/docs/guides/database/postgres/row-level-security).
