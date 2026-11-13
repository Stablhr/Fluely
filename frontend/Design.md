# Design.md — Cadence App Design System (v5, "Slate")

## 1. Direction Summary

Previous state (v4, "So Matcha"): warm ivory page, pastel Tea Green / Vanilla color blocks, a
Celtic Blue rail, 24–32px "blobby" radii, Poppins + Comfortaa type, bouncy motion, and a mascot on
the loading and sign-in screens. It read as playful; the product's users are professionals. The product is now named Cadence
(`lib/brand.ts`).

Current state (v5): a neutral **slate** ramp for surfaces, text, and borders, **one cobalt accent**
for primary actions, links, focus, and selection, semantic colors only where they carry meaning,
Geist as the single UI typeface, 6–12px radii, short straight motion, and a simple geometric mark.
Light and dark themes, chosen in **Settings → Appearance** (Light / Dark / System).

**Token architecture note:** Tailwind v4 with CSS-based config — no `tailwind.config.js`. Tokens are
declared in `@theme` blocks. The shadcn variables in `globals.css` and the app tokens in `kali.css`
share one palette, so auth, landing, docs, admin, and the app read as one system.

---

## 2. Design Tokens

### 2.1 How theming works

- Light values live in the `@theme` block of `frontend/app/kali.css` and in `:root` of
  `frontend/app/globals.css`.
- Dark values override **base** tokens only, in `:root.dark` (kali.css) and `.dark` (globals.css).
  Every alias (`ink-*`, `accent-*`, `sidebar-*`, `base-*`, …) is a `var()` reference to a base
  token, so it follows the theme without its own dark entry. Add a new color as a base token with
  both values, or as an alias of an existing one.
- `lib/theme/theme.ts` stores the choice in `localStorage` (`fluely-theme`, default `light`) and
  toggles `.dark` on `<html>`. An inline script in `app/layout.tsx` applies it before first paint;
  `ThemeSync` follows OS changes when "System" is chosen.
- `dark:*` utilities are class-based (`@custom-variant dark` in globals.css).

### 2.2 Base palette

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `background` | `#f7f8fa` | `#0c0e12` | page canvas |
| `surface` | `#ffffff` | `#14171d` | cards, sidebar, panels |
| `surface-alt` | `#f1f3f6` | `#1b1f27` | insets, hover fills, list columns |
| `surface-elevated` | `#ffffff` | `#1e222b` | popovers, board cards |
| `text-primary` | `#0f172a` | `#e7e9ee` | headings, body |
| `text-secondary` | `#475569` | `#a4acb9` | supporting copy |
| `text-muted` | `#64748b` | `#7f8898` | metadata, placeholders |
| `border` | `#e3e6eb` | `#262b34` | hairlines |
| `border-strong` | `#cdd2da` | `#3a414e` | hover borders, dividers |
| `primary` | `#2554c7` | `#3563e9` | the one accent; white text on it |
| `primary-hover` | `#1e46a8` | `#4a76f0` | |
| `primary-subtle` | `#ebf0fc` | `#172036` | selected rows, active nav |
| `primary-text` | `#1e46a8` | `#93b2ff` | links and accent text on surfaces |

Semantic roles each have a solid, a `-subtle` background, and a `-text` foreground:
success `#15803d`, warning `#b45309`, danger `#c2341f`, info = primary (dark values are lighter
equivalents; see kali.css).

### 2.3 Legacy names

Ported Kali components still use some So Matcha names; they now resolve to neutral or cobalt roles,
so the components re-sync with upstream without edits:

| Name | Now means |
|------|-----------|
| `brand-blue` | cobalt (= primary) |
| `brand-green` | accent tint |
| `brand-vanilla` | neutral tint |
| `brand-ivory` | white — text on cobalt or on dark scrims |
| `brand-ink` | primary text (flips in dark) — never use it for scrims; use `bg-black/50` |
| `accent-teal-*`, `accent-green-*` | `primary-subtle` + `primary-text` |
| `sidebar-bg` / `sidebar-active` | `surface` / `primary-subtle` |

### 2.4 Typography

One family: **Geist** (`--font-geist-sans`), with Geist Mono for code. `font-heading` and
`font-body` are kept as aliases of Geist. Headings differ by weight (600) and slight negative
tracking only; stat numerals use tabular figures.

```css
--text-display: 24px/32px 600;  --text-stat: 24px/30px 600;  --text-card-title: 14px/20px 600;
--text-body: 13px/18px;         --text-label: 11px/14px 600, 0.04em tracking
```

### 2.5 Radius & elevation

| Token | Value | Used by |
|-------|-------|---------|
| `--radius` (shadcn) | 0.5rem | buttons, inputs on shadcn surfaces |
| `--radius-chip` | 6px | chips, small tiles, icon wells |
| `--radius-card` | 10px | cards, list columns |
| `--radius-hero` | 12px | large panels, modals |
| `--radius-pill` | 999px | avatars and small status badges only |

Borders do the structural work; shadows only lift. Shadow color is `--shadow-ink` (slate in light,
black in dark) mixed at 4–18%.

---

## 3. Layout Structure

Sidebar (236px, 52px collapsed) → main scroll area, mobile bottom nav below `md`. Unchanged.

## 4. Component Specs

- **Sidebar** — plain `surface` with a right border; text tiers come from the app tokens. Active
  item: `primary-subtle` background, `primary-text` label, and a 3px cobalt bar.
- **Stat cards** — all one neutral bordered card; the `tone` prop colors only a small dot beside
  the label (blue = primary, green = success, vanilla = warning, white = muted).
- **Promo card** — neutral card with a cobalt primary button.
- **Platform overview** — neutral header strip (`surface-alt`) for every card; the platform's own
  brand color is reserved for its icon.
- **Auth** — split card: a fixed dark-slate brand panel (same in both themes) and the form.
- **Loading curtain** — the brand mark (bars draw in) inside a thin orbiting arc with a breathing
  cobalt halo, the product name, and one status line with an animated ellipsis, on `background`.
  Held for at least `MIN_CURTAIN_MS` (600ms) so it never flashes.
- **Skeletons** — `shared/Skeleton` is a flat `surface-alt` block with a light band sweeping across
  (a transformed pseudo-element) that appears only after 120ms, so fast loads never flash. Every main
  page has a matching skeleton (dashboard, boards, board, schedule), shown until the store reports
  `boardsLoaded` / `isBoardLoaded(id)`.
- **Brand mark** — `components/brand/Logo.tsx` (`BrandMark`, `BrandLogo`; `animated` draws the
  bars in); favicon `public/assets/brand_mark.svg`. All mascot artwork has been deleted.

## 5. Interaction & Motion

One easing family and three durations, defined on `:root` in `kali.css`:
`--ease-out` (a long deceleration, no overshoot), `--ease-in-out`, and `--dur-fast` 120ms /
`--dur-base` 200ms / `--dur-slow` 420ms. Entrances move a few pixels and resolve from a slight blur;
nothing bounces, and nothing idles except progress indicators and the hero glows.

| Utility | Use |
|---------|-----|
| `animate-in` / `animate-drop` | menus, toasts, inline messages (4px fade) |
| `animate-rise` | a page header or section entering |
| `stagger` | on a container: children rise 45ms apart |
| `animate-dialog` / `animate-overlay` | modal panel / its scrim |
| `animate-draw` | SVG strokes with `pathLength={1}` draw themselves in |
| `hover-lift` | interactive cards lift 1px and deepen their shadow |
| `btn-sheen` | primary buttons: a highlight sweeps across on hover |
| `animate-orbit`, `animate-halo`, `animate-beam`, `.loading-dots` | loading curtain and hero effects |
| theme switch | `setThemePreference(pref, origin)`: the new theme spreads as a circle from the click (View Transitions); other browsers cross-fade colors (`html.theme-fading`) |

Entrance utilities use `animation-fill-mode: backwards` so they release their end state and hover
transforms keep working. Dashboard numbers count up (`lib/kali/hooks/useCountUp.ts`). Motion is off
under the OS reduce-motion setting unless the user picks **Full**, and always off with **Reduced**
(`html[data-motion]`, Settings → Appearance).

## 6. Settings

- **Profile** — identity, about, contact and visibility (server).
- **Account & security** — sign-in email, change password (`PUT /auth/password`; does not sign out
  other devices), sign out of this device.
- **Appearance** — theme, density (compact sets `html[data-density]`, which tightens Tailwind's
  `--spacing` unit inside the app), and motion. Per browser, `lib/theme`.
- **Notifications** — in-app and email switches for mentions and invitation responses, saved to the
  account (`preferences.notifications`); board invitations are always delivered.
- **Sharing & privacy** — default visibility for new boards (`preferences.defaultBoardVisibility`,
  used by `CreateBoardModal`).
- **Danger zone** — delete account (`DELETE /account/me`, password plus typing DELETE).

## 7. Content colors

Label swatches, member/avatar colors, and board backgrounds are user content, but their defaults
are muted mid-tones that carry white text at AA contrast (`lib/kali/store/schema.ts`,
`shared/Avatar.tsx`, `settings/SettingsView.tsx`). Platform brand colors stay as authored. Colors
already saved on boards and profiles are not migrated.
