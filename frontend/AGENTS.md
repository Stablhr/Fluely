# Frontend AGENTS.md

## Stack

Next.js 16 App Router, React 19, TypeScript 5, TailwindCSS v4, shadcn/ui, TanStack Query v5, Axios

## Commands

```bash
cd frontend
npm run dev          # Start dev server (port 3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # ESLint
npx tsc --noEmit     # Type check (no script; run it directly)
```

## Architecture

```
app/(app)/          # The app itself — owns / and requires a user session
app/(auth)/         # Public auth pages (sign-in, sign-up, forgot/reset password, verify email)
app/(admin)/        # Admin dashboard — /admin/dashboard (parallel routes: @profile, @settings)
app/(public)/       # Unauthenticated pages: landing/ (/landing) and docs/
app/kali.css        # Content planner design system, scoped to .kali-app
components/kali/    # Ported app components (see "App UI" below)
components/ui/      # shadcn/ui primitives, used by the auth and admin routes
lib/api/            # Axios HTTP client, auth API calls, error handling
lib/hooks/          # React Query hooks (useMeQuery, useLogout)
lib/auth/           # Redirect utilities
lib/kali/           # App store, API modules, realtime polling, hooks, utils
lib/provider/       # ReactQueryProvider
```

## App UI

The product UI is ported from [Stablhr/Kali](https://github.com/Stablhr/Kali) and lives under
`components/kali/` and `lib/kali/`. Three rules keep it isolated from the rest of the app:

- **Token scoping.** `app/kali.css` defines the app's colors, radii, and type scale on `.kali-app`
  (light only — dark mode was removed). `app/(app)/layout.tsx` renders `AppShell` inside that wrapper. Any new
  page that should look like the app must be rendered under it — outside the wrapper, elements
  fall back to the shadcn theme in `globals.css`.
- **Own primitives.** The app uses `components/kali/shared/` (Button, Input, Modal, Toast) instead
  of `components/ui/` to keep upstream styling intact. Use the shadcn equivalents on the auth,
  landing, docs, and admin routes; don't mix the two inside one surface.
- **Brand tokens, not hex.** Colors come from the `brand-*` and semantic tokens in
  `app/kali.css` (So Matcha: Celtic Blue, Tea Green, Vanilla, Ivory, Drab Dark Brown). Never hardcode
  a hex in a component; the full system is documented in [Design.md](./Design.md).

App data lives in `lib/kali/store/`, a `useSyncExternalStore` store backed by `localStorage` and
namespaced per user id. For boards it is a cache in front of the server:

- `lib/kali/api/boards.ts`, `boardChildren.ts`, `invitations.ts`, and `notifications.ts` go through
  the shared `httpClient` (cookies, CSRF, refresh-on-401, error normalization). `StoreProvider`
  loads boards from the API, writes changes through with the board's `revision`, and does a one-time
  import of any board children that still exist only locally.
- `lib/kali/realtime/useBoardPoll.ts` polls the open board every 3.5 s to pick up collaborators'
  changes.
- `lib/kali/api/social-posts.ts` and `social-accounts.ts` still use the legacy fetch wrapper in
  `lib/kali/api/client.ts`, which is inert unless `NEXT_PUBLIC_KALI_API_URL` is set. The backend has
  no social-post or social-account routes, so social posts live in `localStorage` only. Move them to
  `httpClient` when those routes are built; don't add new callers of `client.ts`.
- `AppData.inbox` is deprecated: the Inbox page was removed and legacy items are migrated into a
  board on load. Nothing should read or write it.

Uploaded files go to Cloudinary through `lib/api/mediaApi.ts`, and only the returned HTTPS URL plus
the media `id` are kept in the store. Small files post through the API (`POST /api/media`,
multipart field `files`); large videos use a signed direct upload (`POST /api/media/signature`,
chunked upload to Cloudinary, then `POST /api/media/register`) to get past Vercel's request-body cap.
Never persist base64 file bytes in `localStorage`.

## Code Style

- TypeScript strict mode — no `any` types in new code
- Frontend errors go through `getFriendlyErrorMessage()` — never show raw backend messages to users
- React Query hooks in `frontend/lib/hooks/` for all server state; app data goes through the
  `lib/kali/store/` store instead of new fetch calls
- Use shadcn/ui components from `frontend/components/ui/` for auth, landing, docs, and admin
  surfaces — never build form inputs or modals from scratch there
- Keep `components/kali/` as close to upstream as possible; a change there is easier to re-sync than
  one to shadcn components
- Auth calls live in `lib/api/authApi.ts`; account, profile, media, and embed calls have their own
  modules in `lib/api/`; app (board) calls live in `lib/kali/api/`. All of them use `httpClient`

## Error Handling

All API errors are normalized through `frontend/lib/api/httpClient.ts` into this shape:

```ts
type NormalizedApiError = {
  status: number | null;
  code: string;
  message: string;
  details?: unknown;
};
```

The `getFriendlyErrorMessage()` function maps error codes to user-friendly messages. If a new error code is added on the backend, add a mapping here too.

## Route Groups

- `(auth)` — No auth required. Pages here are public.
- `(app)` — Requires an authenticated user. `app/(app)/layout.tsx` gates on `useMeQuery`, bounces
  signed-out visitors to `/sign-in`, and sends admins to `/admin/dashboard`. It also owns the
  `.kali-app` wrapper and the store, toast, and error boundary providers.
- `(admin)` — Requires admin role. Redirects to `/` if not admin.
- `(public)` — No auth required. `/landing` and `/docs`.

## Dashboard Layouts

The admin dashboard uses **parallel routes** (`@profile`, `@settings`) with a sidebar + mobile
bottom nav. Tab state is managed via `?tab=` search params.

To add a new tab:
1. Create `@tabname/page.tsx` in the dashboard folder
2. Add the tab to `TABS` array in the dashboard `layout.tsx`
3. Add the slot to `slotByTab` and `DashboardLayoutProps`

## Security Rules

- Never commit `.env` files — only `.env.example` is tracked
- Never log tokens, passwords, or secrets
- All API requests go through `httpClient.ts` (handles auth, refresh, error normalization)
- Do not store tokens in localStorage — cookies are managed by the backend
