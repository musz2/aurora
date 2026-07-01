# Authentication & Login

_Last updated: 2026-07-02_

Aurora uses real, production-grade authentication — there is **no demo/mock or
auto login**. Passwords are hashed (bcrypt), sessions are stateless JWT bearer
tokens (access + refresh), and every protected route is enforced server-side.

## Flows

### Signup — `POST /api/auth/signup`
- Validates name/email/password (min 8 chars); email normalized to lowercase.
- Rejects duplicate emails (400).
- Hashes the password with bcrypt (never stored or returned in plaintext).
- Creates the user, a default workspace, an OWNER membership, and a BASIC
  subscription in one transaction.
- Returns a safe user object + access + refresh tokens (no password hash).

### Login — `POST /api/auth/login`
- Looks up the user by lowercased email; verifies the password with bcrypt.
- On success returns the safe user, workspace context, and access + refresh
  tokens. On failure returns **401 "Invalid email or password"** (same message
  for unknown email and wrong password — no account enumeration).
- Rate limited (auth routes are capped at 30 requests/min per IP).

### Session — `GET /api/auth/me`
- Requires a valid access token (Bearer). Returns the current user + workspace +
  plan. Invalid/expired token → 401.

### Refresh — `POST /api/auth/refresh`
- Exchanges a valid refresh token for a new access + refresh token pair.

### Logout — `POST /api/auth/logout`
- Stateless: the client discards its tokens and clears auth state, then is
  redirected to `/login`.

## Frontend behavior
- Tokens are stored in the persisted auth store; the axios client attaches the
  access token and, on a 401, transparently refreshes once and retries (logging
  out if refresh fails).
- On load, the app validates the persisted session via `/auth/me`
  (`bootstrapped` flag); protected routes show a loader until that completes,
  then either render or redirect to `/login` — no flash of protected content and
  no stuck loading screen.
- Login/signup have clean forms with show/hide password, confirm password
  (signup), client validation, loading + disabled states, and clear errors.
  There is **no demo prefill or demo copy**.
- Session persists across refresh; logout fully clears it; expired sessions
  redirect cleanly to login.

## Password reset
Self-service reset requires an email delivery provider, which is not configured
on this deployment. Rather than fake an "email sent" message, the forgot-password
page is honest: it tells the user to ask their workspace owner/admin to reset
access. When an email provider is added, this becomes a real one-time,
hashed-token reset flow.

## Production requirements (fail-clear)
The server **refuses to start** in production unless `JWT_SECRET` and
`JWT_REFRESH_SECRET` are set (no ephemeral/dev secrets in prod), and it refuses
to start if `ENABLE_DEMO_AUTH=true` in production.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection (required) |
| `JWT_SECRET` | Access-token signing secret (required in prod) |
| `JWT_REFRESH_SECRET` | Refresh-token signing secret (required in prod) |
| `ENABLE_DEMO_AUTH` | Must be `false` in production (ignored there) |
| `FRONTEND_URL` / `CORS_ALLOWED_ORIGINS` | Web origin(s) allowed by CORS |
| `SERVER_URL` | Public API URL (links/logs) |

Web (Vercel): set `VITE_API_URL` (and `VITE_WS_URL`) to the API origin so the
browser calls the deployed backend, which must allow that origin via
`FRONTEND_URL` / `CORS_ALLOWED_ORIGINS` (CORS runs with credentials).

## Developer lifetime access boundary
The owner billing override (`docs/BILLING_AND_ENTITLEMENTS.md`) affects **billing
entitlements only**. It never bypasses authentication — the user must still log
in normally — and never bypasses OAuth/provider consent or privacy.

## Deployment login checklist
1. Set `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`.
2. Run `prisma migrate deploy`.
3. On the web, set `VITE_API_URL` / `VITE_WS_URL` and redeploy.
4. Sign up a new account → confirm redirect to the dashboard.
5. Log out → confirm redirect to `/login` and that protected routes bounce back.
6. Log in → refresh the page → confirm the session persists.
7. Try a wrong password → confirm a clear 401 error, no crash.
