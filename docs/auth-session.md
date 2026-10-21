# Supabase Auth session infrastructure

`src/proxy.ts` runs the request-scoped Supabase SSR session helper before page
requests. Static assets and image optimization are excluded. `getClaims()`
verifies/refreshes sessions; no route protection or admin authorization is
performed. Anonymous visitors and visitors with invalid sessions can still
reach public pages. An Auth exception does not redirect them or grant identity.
Future protected code must independently verify claims before authorizing access.

Refresh cookies are forwarded to both the downstream request and the browser,
including chunk deletions and cookie options. The proxy preserves the SSR
package's `Cache-Control`, `Expires` and `Pragma` headers alongside those cookies.
Matched responses also default to `Cache-Control: private, no-store` even when
no refresh occurs. Do not configure shared caches to override these directives
or cache `Set-Cookie` responses.

The existing browser client is unchanged. The server client still supports
Server Components; its optional response argument lets Route Handlers write
cookies and cache headers directly to a response. Server Components rely on
the proxy for response cookie/header writes.

## Signup email confirmation

`GET /auth/confirm?token_hash=…&type=email` calls `verifyOtp()` and persists the
resulting session cookies. `type=signup` is also accepted; recovery, invite,
magic-link and email-change flows are outside this step. Successful confirmation
returns a 303 redirect to `/` on the configured `APP_ORIGIN`, discarding every query parameter. User-supplied
`next` values are never followed. Missing, expired, invalid or unsupported links
and Auth errors return the same generic HTTP 400 text response. Responses are
private/non-cacheable and use `Referrer-Policy: no-referrer`.

The configured Supabase signup confirmation email template appends the path
and token parameters to the trusted application base origin:

```text
{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

Use the correct trusted Site URL and redirect allowlist for each environment.
No email templates or remote settings are changed by the application.
Include the exact base origin sent by signup in the redirect allowlist, such as
`http://localhost:3000` with no trailing slash. A separate
`http://localhost:3000/**` pattern does not cover that bare string. Keep existing
entries and the production Site URL when adding a local development origin.

## Signup, login and logout — Step 5B-5

`/signup` and `/login` use accessible forms and POST Server Actions through the
existing server client. Signup validates email, an eight-character minimum
password, and matching confirmation. Duplicate-account responses use the same
“Check your email” state as successful signup. Raw provider messages are never
rendered. Login reports generic invalid credentials or email-confirmation guidance
and redirects to `/places` after the SSR client writes session cookies.

Account navigation uses verified `getClaims()` results, with Sign in / Sign up
for visitors and a Sign out form for authenticated users. Logout calls
`signOut({ scope: 'local' })` through a POST Server Action, clears this session,
invalidates the layout and redirects to `/`. Other devices remain signed in.
Auth failures leave public discovery available; there are no admin checks or
private membership queries in this UI. Server Function argument logging is
disabled to avoid logging submitted credentials in development.

Set the server-only `APP_ORIGIN` environment variable to the application's
trusted **base origin**, for example `https://your-app.example`. Configure it
separately for production and preview deployments. Production requires HTTPS;
paths, credentials, queries and fragments are rejected. Development defaults to
`http://localhost:3000`; configure an explicit localhost origin for another port.
Neither request Host/forwarded headers nor submitted redirect values are used.
`signUp()` receives only this origin as `emailRedirectTo`; the application never
appends `/auth/confirm` to it. Missing production configuration produces a
generic signup/confirmation error before sending a confirmation request.

Application code does not log tokens or raw provider errors. Next development
request logs omit `/auth/confirm` URLs. When deploying, separately ensure hosting,
reverse-proxy and monitoring access logs redact confirmation query strings;
those external logs cannot be configured by this application change.

## Verification

```powershell
node scripts/check-auth-session.mjs
node scripts/check-auth-ui.mjs
npm run lint
npm run typecheck
npm run build
```

Offline tests use real Next request/response and matcher implementations with
mocked Supabase Auth calls. They cover session refresh cookie chunks/deletions,
cache headers, request isolation, anonymous access, invalid sessions, Auth
failures, confirmation validation, fixed redirects and secret-free errors.
The UI suite additionally exercises the real Supabase SSR client against a fake
in-memory Auth transport: signup/login error handling, base-origin validation,
cookie persistence across requests, verified navigation, logout cookie deletion
and form states. Tests never create hosted accounts or send emails. A real
signup/email round trip and hosted-session check require a manually authorized
account and the deployed `APP_ORIGIN` setting.

## Hosted development verification — Step 5B-6

Tested at `http://localhost:3000` against the hosted development project on
2026-10-21. Credentials were entered manually in the browser; they were not
captured in the report, logs or test fixtures. No privileged keys or RLS bypass
were used.

- Signup, short-password/mismatch validation and the confirmation state passed.
- Invalid credentials were rejected, and unconfirmed accounts received the
  expected confirmation guidance.
- The initial email went to Vercel because the allowlist contained the
  `http://localhost:3000/**` pattern without the exact bare base origin. The user
  added `http://localhost:3000`, preserving the existing pattern and Site URL,
  then explicitly authorized a retry with a laptop-accessible email address.
- The retry delivered its email and the user confirmed the unmodified link
  successfully on localhost.
- Real login redirected to `/places`; verified navigation and the session
  persisted across refresh. `/places` and `/discover` remained functional.
- A temporary development-only, authenticated read verified the user's own
  profile through RLS and confirmed its creation during the test run. It
  returned booleans only and was removed afterward; the endpoint returned 404.
- POST logout returned to `/`, removed the session cookies and authenticated
  navigation, and stayed signed out after refresh. Public discovery still worked.
- Missing/malformed and fabricated invalid-token confirmation requests returned
  generic, non-cacheable errors without consuming real signup tokens. Expired
  token error handling is also covered by the offline suite.

The lasting local changes for this verification are the Git-ignored
`APP_ORIGIN=http://localhost:3000` setting and the corrected redirect guidance
in this document. No application behavior, migrations or RLS policies were
changed for testing. Hosted test-account cleanup is manual and optional.

References: [Supabase SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[SSR caching guidance](https://supabase.com/docs/guides/auth/server-side/advanced-guide),
and [Next.js signup confirmation tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs).
