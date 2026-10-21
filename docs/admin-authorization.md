# Administrator authorization — Step 5D-2

Migration: `supabase/migrations/20261021000005_admin_status_rpc.sql`.
Apply only after migration 004. This step does not apply it remotely.

## Manual rollout

1. Review the complete migration SQL. In the intended development project's
   Supabase SQL Editor, execute that file as the trusted database owner, or use
   your normal reviewed migration workflow. Do not reapply migrations 001–004.
2. Keep exposed API schemas unchanged (`public`, `graphql_public`); never expose
   `private`. No keys, Auth settings or membership changes are required.
3. Sign in using the existing confirmed administrator account. Visit `/admin`
   and `/admin/login` (the latter redirects an authorized administrator to
   `/admin`). Verify the Admin navigation link.
4. Verify an anonymous `/admin` or nested request redirects to `/login`, a
   normal member receives 403 Access denied, and public browsing still works.
   Use existing accounts; no test-account creation is automated.

## Security boundary

The public RPC is zero-argument, read-only, boolean-only, `SECURITY INVOKER`,
with an empty search path and EXECUTE granted only to `authenticated`.
It delegates to the existing qualified `private.is_admin()` helper, whose
privileged membership read was established in migration 004. No table, column,
policy, membership or schema-exposure permissions are changed. Anonymous and
service-role execution grants are explicitly revoked, including PUBLIC defaults.
This follows [Supabase function security guidance](https://supabase.com/docs/guides/database/functions).

The existing SSR client uses the publishable key plus the caller's cookies.
`getClaims()` verifies identity before the RPC uses that same authenticated
context. Emails, headers, role claims and user metadata do not grant access.
Email confirmation remains an Auth prerequisite and an operator prerequisite
for membership assignment; application code does not grant membership.

The existing session-refresh proxy checks all `/admin` paths, including nested
and RSC requests. Anonymous/invalid sessions redirect to the fixed `/login`
path; non-admins receive 403; RPC errors, missing migrations, malformed results
and thrown provider failures receive a generic 503. Refresh/deletion cookies
survive these responses; authorization responses are private and no-store.
No provider error details, IDs, records or tokens are rendered or logged.

The layout and both existing pages also call `requireAdmin()`. Layout checks
alone do not protect Next.js child rendering. Future privileged data helpers,
route handlers and Server Actions must call `requireAdmin()` themselves before
work; proxy and navigation visibility do not replace authorization at the data
boundary or future database RLS policies. No CRUD permissions exist in this step.
Status results are not persisted or shared between requests; later membership
revocation is checked on the next server request. Already rendered browser UI
can remain visible until navigation/refresh, but does not authorize future work.

Until migration 005 is applied, signed-in admin requests fail closed with 503
and no Admin link appears. Hosted integration with the real administrator must
be verified manually after application; offline tests do not verify hosted API
schema exposure or project configuration.

## Verification

```powershell
node scripts/check-admin-access.mjs
node scripts/check-auth-session.mjs
node scripts/check-auth-ui.mjs
node scripts/check-auth-foundation.mjs "C:\path\to\@electric-sql\pglite\dist\index.js"
node scripts/check-places-page.mjs
node scripts/check-homepage.mjs
node scripts/check-restaurant-detail.mjs
npm run lint
npm run typecheck
npm run build
# Supported fallback if the environment cannot start Turbopack workers:
npm run build -- --webpack
```

Foundation/RPC tests execute PostgreSQL offline with simulated API roles,
including caller-only status, grants, revocation, membership privacy, unchanged
RLS/ACLs and public restaurant reads without catalogue writes. Route tests use
real Next request/response objects and mocked Supabase responses, including
nested/RSC requests, forged role inputs, errors, cookies and server page guards.
