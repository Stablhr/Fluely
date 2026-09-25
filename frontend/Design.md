# Design.md — Fluely App Design System (v4, "So Matcha")

## 1. Direction Summary

Previous state (v3, inherited from Kali): cool grey-teal surfaces, near-black sidebar rail, soft
pastel-tinted stat cards, Inter/Geist type, 20px card radius.

Current state (v4): the **So Matcha** brand system — warm ivory page, saturated flat color blocks
instead of tinted washes, a Celtic Blue rail, rounded blobby geometry, and a two-family type
system (Poppins for headings and numerals, Comfortaa for body).

**Scope:** this is a visual re-skin only. Layout, component structure, and behavior are unchanged.
Every change lands in tokens (`frontend/app/globals.css`, `frontend/app/kali.css`) plus a small
number of className swaps in the components listed in §7.

**Token architecture note:** this is **Tailwind v4 with CSS-based config** — there is no
`tailwind.config.js`. Tokens are declared in `@theme` blocks in the stylesheets. The app palette is
scoped to `.kali-app`; the shadcn palette in `globals.css` serves the auth, landing, docs, and admin
routes. Both were moved to the brand together so the whole product reads as one system.

---

## 2. Design Tokens (Tailwind v4)

### 2.1 Brand Palette

The five canonical brand colors. Use these directly (`bg-brand-blue`, `text-brand-ink`, …) for
brand moments; use the semantic tokens in §2.2 for everything else.

| Token | Hex | Role |
|-------|-----|------|
| `--color-brand-blue` | `#3971b8` | Celtic Blue — primary buttons, active nav, links, sidebar rail |
| `--color-brand-green` | `#c8d69b` | Tea Green — stat/tag block, success tint, active accent |
| `--color-brand-vanilla` | `#f6e6a5` | Vanilla — stat/tag block, highlights |
| `--color-brand-ivory` | `#fbfcee` | Ivory — page background, text on blue blocks |
| `--color-brand-ink` | `#343b1b` | Drab Dark Brown — headings, body text, text on green/vanilla |

```css
@theme {
  --color-brand-blue: #3971b8;
  --color-brand-green: #c8d69b;
  --color-brand-vanilla: #f6e6a5;
  --color-brand-ivory: #fbfcee;
  --color-brand-ink: #343b1b;
}
```

### 2.2 Semantic Palette

Semantic tokens are the default vocabulary. They resolve to brand colors or to warm relatives of
the ink brown, so the UI never drifts off-palette.

```css
/* Surfaces */
--color-background: #fbfcee;        /* page — Ivory */
--color-surface: #ffffff;           /* cards — white, so they lift off the ivory page */
--color-surface-alt: #f4f3e2;       /* insets, hover fills */
--color-surface-elevated: #ffffff;  /* dropdowns, popovers */

--color-text-primary: #343b1b;      /* headings and primary copy — Drab Dark Brown */
--color-text-secondary: #5f6740;    /* supporting copy */
--color-text-muted: #8a9068;        /* placeholders, timestamps */

--color-border: #e4e3cd;
--color-border-strong: #cfceac;

/* Primary = Celtic Blue */
--color-primary: #3971b8;
--color-primary-hover: #2f5c96;
--color-primary-foreground: #fbfcee;
--color-primary-subtle: #e6edf8;
--color-primary-text: #2f5c96;      /* blue text on light surfaces */

/* Semantic status — success leans Tea Green */
--color-success: #8fa85c;      --color-success-subtle: #eef3de;  --color-success-text: #4c5c22;
--color-warning: #d9a520;      --color-warning-subtle: #fbf3d4;  --color-warning-text: #7a5c07;
--color-danger:  #cf4b40;      --color-danger-subtle:  #fbe9e7;  --color-danger-text:  #a3332a;
--color-info:    #4a86c8;      --color-info-subtle:    #e6edf8;  --color-info-text:    #2f5c96;

/* Canvas + neutral ramp */
--color-board-canvas: #f4f3e2;
--color-list-default: #ffffff;
--color-base-bg: #f4f3e2;
--color-base-surface: #ffffff;
--color-base-surface-alt: #faf9ec;
--color-ink-900: #343b1b;  --color-ink-700: #5f6740;
--color-ink-500: #8a9068;  --color-ink-300: #cfceac;

/* Flat brand blocks — NOT tinted washes */
--color-accent-purple-bg: #ffffff;  --color-accent-purple-text: #343b1b;  /* white neutral */
--color-accent-green-bg:  #c8d69b;  --color-accent-green-text:  #343b1b;  /* Tea Green */
--color-accent-yellow-bg: #f6e6a5;  --color-accent-yellow-text: #343b1b;  /* Vanilla */
--color-accent-teal-bg:   #3971b8;  --color-accent-teal-text:   #fbfcee;  /* Celtic Blue */

--color-sidebar-bg: #3971b8;       /* the rail is brand blue, not near-black */
--color-sidebar-active: #2f5c96;   /* deeper blue for the active row */
--color-sidebar-accent: #c8d69b;   /* Tea Green left-accent on the active item */
```

### 2.3 Typography

Two families, loaded through `next/font` in `frontend/app/layout.tsx` and published as Tailwind
utilities via `@theme inline` in `globals.css`.

```css
@theme inline {
  --font-heading: var(--font-poppins);
  --font-body: var(--font-comfortaa);
}
```

| Role | Family | Weights | Applied to |
|------|--------|---------|------------|
| Display, stat numbers, wordmark, `h1`–`h4` | Poppins | 600–700 | page titles, big numerals, logo-type |
| Body, labels, table content, everything else | Comfortaa | 400–600 | paragraphs, labels, secondary copy |

`.kali-app` sets Comfortaa as the inherited family and promotes Poppins for `h1`–`h4`,
`.text-display`, `.text-stat`, and `.font-heading`. Components rarely need to opt in by hand;
`font-heading` / `font-body` exist for the cases that do.

Type scale (unchanged from v3, now rendered in Poppins):

```css
--text-display: 28px;  --text-stat: 26px;  --text-card-title: 14px;
--text-body: 13px;     --text-label: 11px;
```

### 2.4 Radius & Elevation

Geometry is deliberately exaggerated and pill-heavy — rounded edges are the brand, not a
rounding-off of something else.

| Token | Value | Used by |
|-------|-------|---------|
| `--radius-hero` | 32px | hero and feature cards (`rounded-hero`) |
| `--radius-card` | 24px | cards, modals, list columns (`rounded-card`) |
| `--radius-chip` | 16px | chips, inputs, small tiles (`rounded-chip`) |
| `--radius-pill` | 999px | buttons, tags, badges (`rounded-pill`) |

Tailwind's own scale is widened by `--radius: 1.25rem` in `globals.css`, so shadcn surfaces get
the same rounder feel.

Shadows are soft and low-opacity, tinted with the ink brown rather than neutral black. Cards are
flat by default; elevation is reserved for things that float.

```css
--shadow-card: 0 2px 10px rgba(52, 59, 27, 0.04);
--shadow-card-hover: 0 6px 20px rgba(52, 59, 27, 0.07);
--shadow-subtle: 0 1px 3px rgba(52, 59, 27, 0.05);
--shadow-medium: 0 6px 20px rgba(52, 59, 27, 0.08);   /* dropdowns */
--shadow-modal: 0 18px 50px rgba(52, 59, 27, 0.16);    /* modals, drawers */
```

Stat cards carry **no** shadow — the flat color block is the treatment.

---

## 3. Layout Structure

Unchanged from v3. Sidebar rail (236px, 52px collapsed) → main scroll area, mobile bottom nav
below `md`.

---

## 4. Component Specs

### 4.1 Sidebar

Celtic Blue rail (`bg-sidebar-bg`), ivory text and icons, `--surface-*` adaptive vars seeded from
`#3971b8` so contrast math matches the new rail. The active row gets the deeper
`bg-sidebar-active` plus a Tea Green left-accent bar (`bg-brand-green`) — the accent had to move
off `bg-primary` because primary is now the rail color itself. Inbox count badges are Vanilla pills
with ink text so they stay legible on blue.

### 4.2 Stat Cards

Four flat color blocks, rotating — no tinting, no shadow, 24px radius:

| Tone | Block | Text |
|------|-------|------|
| `green` | Tea Green `#c8d69b` | Drab Dark Brown |
| `vanilla` | Vanilla `#f6e6a5` | Drab Dark Brown |
| `blue` | Celtic Blue `#3971b8` | Ivory |
| `white` | White + hairline border | Drab Dark Brown |

The Dashboard uses green / vanilla / blue / white for Boards, Due this week, Inbox unread, and
Starred boards. Text color is carried on the block itself, so a tone is always readable.

### 4.3 Hero Card

`rounded-hero` (32px) white card on the ivory page. Chart stroke and the trend chip use the blue
subtle/accent pair.

### 4.4–4.7 Lists, Right Panel, Top Bar

Unchanged structurally; all colors come from the tokens above. The Promo card is a Celtic Blue
block (`bg-sidebar-bg`) with ivory copy and a Vanilla pill CTA.

---

## 5. Interaction & Motion

Unchanged: 150ms color transitions, `scale-[0.98]` on press, 200ms sidebar width transition, the
existing `animate-in` / `animate-drop` keyframes. Focus rings are `ring-primary/40` and
`outline-primary`.

---

## 6. Dark Mode

The So Matcha palette is designed as the light theme. Dark mode keeps the same hues at lower
luminance — brand blue lifts to `#5b93d6`, the ivory page becomes `#1a1d12`, ink text inverts to
`#f2f3e4`, and Tea Green / Vanilla become muted block colors — so the brand still reads rather
than turning into a different product.

`.dark .kali-app` overrides every semantic token; the `.kali-app` scope also re-declares the four
tokens that `globals.css` maps onto the shadcn variables (`--background`, `--primary`,
`--primary-foreground`, `--border`), because `@theme inline` in `globals.css` wins for those
names.

The theme lives in the local store (`data.ui.darkMode`) and is toggled from `/settings`.

---

## 7. Implementation Notes

Token edits:

- `frontend/app/globals.css` — shadcn `:root` / `.dark` recolored to the brand; `--radius`
  widened; `--font-heading` / `--font-body` published; `--font-heading: var(--font-mono)` bug fixed
- `frontend/app/kali.css` — full `@theme` rewrite, `.kali-app` and `.dark .kali-app` scopes, the
  Poppins/Comfortaa rules, `scroll-slim` recolored to blue

Component edits (color and className only):

- `dashboard/StatCard.tsx` — tone union renamed to `blue | green | vanilla | white`; per-tone text
  colors; shadow removed
- `dashboard/DashboardView.tsx` — the four tone call sites
- `dashboard/HeroCard.tsx` — `rounded-hero`
- `dashboard/PromoCard.tsx` — ivory copy, Vanilla pill
- `layout/Sidebar.tsx` — blue rail accents, Tea Green active bar, Poppins wordmark, adaptive seed
- `shared/Modal.tsx`, `card-modal/CoverPanel.tsx`, `boards/BoardMenuDrawer.tsx`,
  `social/{AIGenerate,BulkSchedule,CardSocialPosts,Compose,MediaLibrary,PostDetail}Modal.tsx` —
  scrims `bg-[#0f1a19]/50` → `bg-brand-ink/50`
- `boards/BoardsHome.tsx` — scrims and the board-name pill
- `boards/{ListMenu,ShareModal,TimelineView}.tsx`, `card-modal/CoverPanel.tsx`,
  `content-planner/{TipsGoalsSidebar,ContentPostCard}.tsx`, `lib/kali/store/schema.ts` — the old
  teal default swatch `#0DABA3` → `#3971B8`

Platform brand colors, label swatches, and member avatar colors are **content**, not theme — those
hex values stay as authored.

Layout, data flow, and behavior are untouched.
