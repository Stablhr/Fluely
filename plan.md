# Fluely — Project Plan

Companion docs:

- [`design.md`](./design.md) — product and UI direction for the planner.
- [`frontend/Design.md`](./frontend/Design.md) — implementation-level design tokens and component specs.
- [`AGENTS.md`](./AGENTS.md) — stack overview and conventions. Sub-guides live in `frontend/` and `backend/`.

## What Fluely is

A social content planner: plan posts across platforms, see them on a calendar, board, or table, and
edit them in place. Built on an auth boilerplate — a Next.js 16 frontend plus an Express API with
JWT auth, roles, email verification, and password reset. The planner UI is ported from
[Stablhr/Kali](https://github.com/Stablhr/Kali) into `frontend/components/kali/`.

## Current state

### Shipped

| Area | Status |
|---|---|
| Auth | Sign in/up, email verification, password reset, JWT + refresh, User/Admin roles. Working against the Express API. |
| Admin | `/admin/dashboard` with `@profile` and `@settings` parallel routes, `?tab=` switching. |
| Landing / docs | `/landing`, `/docs`. |
| Planner app | Boards (Board/Calendar/Table/Timeline/Map views), Inbox, Schedule, Settings, Dashboard. |
| Content Planner | Platform overview + calendar / board / table views over one shared post state, with a right-side slide-over editor. |
| Branding | So Matcha design system applied, dark mode removed, Fluely logo + mascot assets, branded auth pages and loading screen. |
| Data | `useSyncExternalStore` store backed by `localStorage`, namespaced per user id. |

### Architecture reality worth knowing

**App data is not persisted server-side.** The backend exposes `/auth` only — `productRoutes` is
still commented out in `backend/api/routes/index.ts`, so the planner API work is scaffolding (Zod
DTOs in `backend/api/dtos/product.dto.ts`) with no routes wired to it. Until someone builds those
endpoints and sets `NEXT_PUBLIC_KALI_API_URL`, all planner data lives in the browser.

**The remote client is called but never gated.** `isRemoteEnabled` in
`frontend/lib/kali/api/client.ts` is exported and used nowhere else. Store writes fire the remote
call optimistically and swallow the failure (`.catch(() => {})`), so the app behaves correctly
offline but will also fail *silently* once a backend exists. This is the first thing to fix when
persistence lands.

## Next steps

Ordered by dependency, not by size.

1. **Verify the planner in a browser.** The rebuild passes `tsc`, `eslint`, and `next build`, but has
   never been rendered. Check drag-and-drop, the day popover, slide-over layout at mobile widths, and
   the table's date-range filter before building on top of it.
2. **Build the planner API.** Wire `product.dto.ts` to routes, register them, then set
   `NEXT_PUBLIC_KALI_API_URL`. Gate the client on `isRemoteEnabled` in the same change so failures
   stop being invisible.
3. **Resolve the two post editors.** `social/ComposeModal.tsx` (629 lines) and
   `content-planner/PostDetailPanel.tsx` both create and edit a `SocialPost`, with overlapping but
   different field sets. Pick one, or make the panel the shared core that ComposeModal composes.
4. **Decide the logo situation.** The small inline logo in the auth page's left panel and the large
   overlapping wordmark both point at `fluely_logo.png`, so they are the same artwork at two sizes.
   If the intent was two distinct marks, the small one should point at `fluely_favicon.png`.
5. **Add a first test suite.** Jest and Supertest are configured but no tests are committed. The
   store reducer and the status/stage folding map in `planner-model.ts` are the highest-value first
   targets — both are pure functions with branching logic.
6. **Reconcile `/schedule` with the Content Planner.** They are still two separate models: board
   cards with due dates versus social posts with scheduled dates. Either merge them or document why
   both exist.

## Known gaps

- **README is stale in three places.** The overview, the feature list, and the directory tree
  (`README.md:6`, `:20`, `:79`) all still describe the Content Planner as a "weekly time grid
  (6 AM – 11 PM) … drag posts into time slots". That surface was replaced by the multi-view planner.
- **`SidebarTab` still includes `'goals'`** but no UI reaches it; the tips/goals sidebar is opened
  only on the `tips` tab.
- **No dark mode** — deliberately dropped so every route stays on the ivory canvas. Re-adding it
  means a second pass over `frontend/app/kali.css`.
- **`frontend/Design.md` references `ContentPostCard.tsx`**, deleted in the planner rebuild. Left
  as-is because that section records a past color migration; correcting it would rewrite history.

## Working on this repo

```bash
cd frontend
npm run dev          # port 3000
npx tsc --noEmit     # type check (no script; run directly)
npm run lint         # ESLint
npm run build        # production build
```

There is no prettier config in this repo. Running `npx prettier --write` applies prettier's
defaults — double quotes and bracket spacing — which fights the existing style (single quotes, no
bracket spacing) and produces a whole-file diff. Format by hand, or add a config first.

Commits follow conventional commits: `fix:`, `feat:`, `refactor:`, `chore:`, `docs:`.
