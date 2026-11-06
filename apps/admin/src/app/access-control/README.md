# Access control (placeholder — not implemented)

The back office has **no access control yet**. Every page is reachable by anyone who can load the
app. This document describes where and how it will be added; nothing in the code pretends to
protect a route today, on purpose.

## Principle: the API is the authority

Authorization is enforced **by the API**, on every request. Health data (and any future admin
data) will only be returned to authenticated users holding an authorized role; other callers get
`401` / `403`.

The front-end guard is **UX only**: it avoids showing pages and navigation entries a user cannot
use, and redirects to a sign-in or "forbidden" screen. It is not a security boundary — the bundle,
the routes and the API URLs are public, so anything hidden in the UI must still be refused by the
API.

## Where the guard will sit

1. **Routes** — `src/app/router.tsx`. When a router library is introduced (second page), each
   route will declare the roles allowed to open it, and a guard will wrap the routes: no session →
   sign-in, session without a required role → forbidden page.
2. **Navigation** — `src/app/layout/navigation.ts` / `Sidebar.tsx`. Each nav item will declare
   its allowed roles; the sidebar will only render the items the session roles grant.
3. **API errors** — a `401` / `403` from the API (`ApiError` with `kind: 'http'`) must be handled
   as "signed out" / "forbidden", never retried blindly.

## Intended shape

- Roles come from the **authenticated session** (issued by the API, e.g. in the session or token
  payload). The front end never decides or stores roles on its own.
- The session is exposed through a context (`SessionContext`, read with a `useSession()` hook),
  like `ApiClientContext` today, so features and tests can inject it.
- Role names are a shared contract: they will be declared as types in `@e-deep/shared`, consumed
  with `import type`.
- Permission checks are pure functions (`canAccess(session, allowedRoles)`), unit-tested, and
  reused by the route guard and the sidebar filter.

## What must not be done

- No pass-through guard component (e.g. `<RequireRole>` that renders its children
  unconditionally): it would make readers believe routes are protected.
- No role check based on client-only state (local storage, URL, feature flags).
