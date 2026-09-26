/**
 * Shared class strings for the `(auth)` route group.
 *
 * The group renders inside the floating card defined in `app/(auth)/layout.tsx`,
 * so every page in it needs the same field treatment to look consistent. Tokens
 * come from the So Matcha palette in `app/kali.css` — no hex literals here.
 */

export const authTitleClass =
  'font-heading text-[28px] font-bold leading-tight tracking-tight text-brand-ink';

export const authSubtitleClass =
  'font-body text-[15px] leading-relaxed text-muted-foreground';

export const authLabelClass =
  'font-body text-[14px] font-medium text-brand-ink';

// `--radius` is 1.25rem here, so stock `rounded-2xl` would resolve to 36px and
// read as a pill on a 48px field. `rounded-xl` (28px) keeps the soft rounding
// the design calls for while staying distinct from the pill-shaped button.
export const authInputClass =
  'h-12 rounded-xl border-border bg-background px-4 py-2.5 font-body text-[15px] text-brand-ink placeholder:text-ink-faint focus-visible:border-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue/25 dark:bg-background dark:text-brand-ink md:text-[15px]';

export const authPrimaryButtonClass =
  'h-12 w-full rounded-full bg-brand-blue px-6 font-body text-[15px] font-semibold text-white hover:bg-blue-hover';

export const authSecondaryButtonClass =
  'h-12 w-full rounded-full border-border bg-background px-6 font-body text-[15px] font-semibold text-brand-ink hover:bg-secondary';

export const authPasswordToggleClass =
  'absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-secondary transition-colors hover:text-brand-ink';

export const authInlineLinkClass =
  'font-body font-semibold text-brand-blue hover:underline';

export const authFooterClass =
  'text-center font-body text-[15px] text-muted-foreground';

export const authErrorClass =
  'rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 font-body text-sm text-destructive';

export const authSuccessClass =
  'rounded-2xl border border-brand-green/60 bg-green-subtle px-4 py-3 font-body text-sm text-brand-ink';
