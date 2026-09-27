# Fluely — Design Direction

Scope: product and UI direction. Implementation-level tokens, type scale, and component specs live
in [`frontend/Design.md`](./frontend/Design.md) — this document does not restate them. Current work
and priorities live in [`plan.md`](./plan.md).

## Brand

**So Matcha** — a warm, low-contrast palette that reads as a workspace rather than a dashboard tool.
Celtic Blue carries interaction and emphasis; Tea Green, Vanilla, and Ivory are the supporting
surfaces; Drab Dark Brown is the ink. Dark mode was removed so every route sits on the same ivory
canvas and the palette never has to be re-derived for a second theme.

Two typefaces carry the whole product: **Poppins** for headings, numerals, and the wordmark;
**Comfortaa** for everything else. Both are declared once on `.kali-app` in `frontend/app/kali.css` —
components should apply `font-heading` / `font-body` and never name a family directly.

Cards are `rounded-2xl` / `rounded-3xl` on white, separated by hairline borders and very soft
shadows. Depth comes from layered translucency, not from heavy drop shadows. Use the `shadow-subtle`
/ `shadow-medium` / `shadow-modal` scale rather than ad-hoc shadows.

## The Content Planner

The planner is one surface with four parts, stacked top to bottom. They are not separate pages,
because they answer different questions about the same set of posts.

### 1. Platform overview

A row of cards — one per platform plus an "All channels" aggregate — each showing total posts,
scheduled / posted / in-progress counts, and how many distinct days carry work for that platform.
The card body is a flat color block rotating through the brand palette, so the row reads as one set
instead of a brand-color clash.

Platform *brand* color (Instagram pink, YouTube red) is reserved for icons and accents. The
overview blocks deliberately do not use it. Clicking a card sets the active platform filter, which
every view below respects.

### 2. Three views over one state

**Calendar** — month and week. Month cells cap visible pills and collapse the rest into a "+N more"
that opens a day popover; the popover lists everything on that day and offers "Add post". Each day
has a `+` that opens the editor prefilled with that date, and on touch widths it is always visible
while on desktop it reveals on hover.

**Board** — five columns: Idea, Draft, In Review, Scheduled, Posted. Cards drag between columns and
dropping sets the post's stage. A card shows a platform-accent bar, title, optional thumbnail, tags,
platform icons, and its date. Single-platform posts take that platform's color; multi-platform posts
use ink brown, so the accent never implies the wrong destination.

**Table** — the scanning view. Title, Platform, Status, Scheduled, Tags, Linked board, with
search across title/caption/notes/tags, a date range, and sortable columns. A date range
intentionally excludes undated posts: a date window is a question about *scheduled* work, and
silently including ideas would misreport how much is actually planned.

All three read one filtered list, so switching tabs or toggling a platform can never desync what the
counts say from what the grid shows.

### 3. Post detail

A right-side slide-over, not a centered modal — the point is to edit a post while still seeing the
context that led you to it. It handles both create and edit. Fields: inline title, stage picker,
platform chips, date and time, caption, media, tags, linked board, notes. Linked board resolves
through the post's `cardId` to a card's parent board.

### 4. Quick capture

A single "New post" action in the header, consistent with the dashboard's capture affordance. Every
entry point — header button, calendar `+`, board column `+`, table row — opens the same editor.

## The Post model

One entity, `SocialPost` in `frontend/lib/kali/store/schema.ts`, is the single source of truth. It
already carries title, caption, per-platform overrides, media, tags, a linked board (`cardId`),
schedule date/time, and publishing analytics. Do not add a parallel `Post`.

### Stages vs. publishing outcomes

`SocialPostStatus` mixes two concerns: the planning stages a person drives
(`idea → draft → in_review`) and the outcomes a publisher produces (`publishing`, `posted`,
`partially_published`, `failed`, `cancelled`).

The board and table show five stages. Outcomes are folded into the nearest stage by
`POST_COLUMN_FOR_STATUS` in `content-planner/planner-model.ts` — a failed publish is still a post
someone has to act on, so it should not vanish from the board. That map is the single place this
decision lives; change it there, not in a view.

`planner-model.ts` owns the column, stage, platform, and sort definitions the views share. If a
status needs renaming, it is a one-file change.

## Conventions

- **Tokens, not hex.** Colors come from `brand-*` and the semantic tokens in `frontend/app/kali.css`.
- **Own primitives.** App surfaces use `components/kali/shared/`; auth, landing, docs, and admin use
  `components/ui/`. Do not mix them in one surface.
- **One data path.** App state goes through `lib/kali/store/`, not new fetch calls. Server state
  goes through React Query hooks in `lib/hooks/`.
- **Errors are normalized.** Never surface a raw backend message; map codes through
  `getFriendlyErrorMessage()`.
- **Stay close to upstream** in `components/kali/` — it is a port, and drift makes re-syncing harder.

## Open design questions

- The auth page's small inline logo and the large overlapping wordmark currently render the same
  asset at two sizes. Decide whether there should be two distinct marks.
- `social/ComposeModal.tsx` and `content-planner/PostDetailPanel.tsx` are two post editors with
  different field sets. The long-term shape should be one editor, or one composing the other.
- The engagement/tips sidebar survived the planner rebuild as a toggle. It is not part of the
  four-part structure above, so its place in the information hierarchy is still open.
