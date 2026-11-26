# Access control (implemented — auth lot 7)

The back office requires a **staff session** (`support` or `admin`, D42) on every page but
`/login`, `/logout` and `/forbidden`. This document describes how the front end checks it.

## Principle: the API is the authority

Authorization is enforced **by the API**, on every request (D37): `/api/admin/*` only accepts the
admin session cookie, and answers `401` without a session, `403` for a role that is not enough.

The front-end guard is **UX only**: it avoids showing pages and navigation entries a user cannot
use, and redirects to the sign-in or "forbidden" screen. It is not a security boundary — the bundle,
the routes and the API URLs are public, so anything hidden in the UI must still be refused by the
API.

## How it works

| Piece              | File                                                                        | Role                                                                                                                                                                                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route table        | `../routes.tsx`                                                             | React Router data mode (D42). Each protected route declares `handle: { allowedRoles }` (`StaffRoute`).                                                                                                                                                                                                    |
| Route guard        | `sessionLoaders.ts` · `requireStaffSession`                                 | Loader of the protected layout: `GET /api/admin/me`; `401` → `/login?next=<path>`, `403` → `/forbidden`; then `canAccess(session, allowedRoles)` on the deepest matched route, refused → `/forbidden`. Runs again on every page change (`shouldRevalidate`). Any other failure reaches the error element. |
| Sign-in page guard | `sessionLoaders.ts` · `redirectIfSignedIn`                                  | Loader of `/login`: a session already open goes on to `next`, else the form is shown.                                                                                                                                                                                                                     |
| `next`             | `safeNext.ts`                                                               | Internal paths only (no `//host`, `/\host`, control characters, session pages); `/` otherwise.                                                                                                                                                                                                            |
| Session            | `session.ts` · `SessionContext`, `useSession()`                             | Fed by the guard's loader data (`layout/ProtectedLayout.tsx`); tests provide their own. Roles come from the API only.                                                                                                                                                                                     |
| Permission check   | `canAccess.ts`                                                              | Pure function, unit-tested, shared by the route guard and the sidebar.                                                                                                                                                                                                                                    |
| Navigation         | `../layout/navigation.ts`, `Sidebar.tsx`                                    | Each nav item declares `allowedRoles`; `navItemsFor` keeps the items `canAccess` grants.                                                                                                                                                                                                                  |
| Later API calls    | `sessionNavigation.ts`, `../services.ts`                                    | The pages' API client (`ApiClientContext`) calls `onSessionError` on a `401` / `403`: to `/login?next=<page>` or `/forbidden`, history replaced, never retried.                                                                                                                                           |
| Sign-in / sign-out | `../authRoutes.ts`, `../routes/LoginPage.tsx`, `../layout/LogoutButton.tsx` | Route actions over `POST /api/admin/auth/login` (`AdminLoginRequest`) and `POST /api/admin/auth/logout`.                                                                                                                                                                                                  |

The loaders and actions use a client **without** `onSessionError`: they turn a `401` / `403` into a
redirect or a form message themselves. Both clients send the session cookie
(`credentials: 'same-origin'`, same origin as the API, D34).

## Adding a page

1. Add a `StaffRoute` to `STAFF_ROUTES` in `../routes.tsx`, with its `allowedRoles`.
2. If it is in the sidebar, add a `NAV_ITEMS` entry with the **same** `allowedRoles`
   (`../layout/navigation.test.ts` fails otherwise). A page open to all staff uses `STAFF_ROLES`
   (`@/shared/lib/staffRoles`), the one list of the roles in the front end.
3. The API route must refuse the other roles itself (`@Roles(...)`).

## What must not be done

- No pass-through guard component (e.g. `<RequireRole>` that renders its children
  unconditionally): it would make readers believe routes are protected. The guard is the loader.
- No role check based on client-only state (local storage, URL, feature flags).
- No retry of a call answered `401` / `403`.
