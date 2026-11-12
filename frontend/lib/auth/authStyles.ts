/**
 * Shared class strings for the `(auth)` route group.
 *
 * The group renders inside the card defined in `app/(auth)/layout.tsx`, so every
 * page in it needs the same field treatment to look consistent. Colors are theme
 * tokens (app/globals.css, app/kali.css), so the forms follow light and dark.
 */

export const authTitleClass =
  'text-[24px] font-semibold leading-tight tracking-tight text-foreground';

export const authSubtitleClass = 'text-[14px] leading-relaxed text-muted-foreground';

export const authLabelClass = 'text-[13px] font-medium text-foreground';

export const authInputClass =
  'h-10 rounded-md border-input bg-card px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 md:text-[14px]';

export const authPrimaryButtonClass =
  'h-10 w-full rounded-md bg-primary px-4 text-[14px] font-medium text-primary-foreground hover:bg-primary-hover';

export const authSecondaryButtonClass =
  'h-10 w-full rounded-md border-input bg-card px-4 text-[14px] font-medium text-foreground hover:bg-secondary';

export const authPasswordToggleClass =
  'absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground';

export const authInlineLinkClass = 'text-[13px] font-medium text-primary-text hover:underline';

export const authFooterClass = 'text-center text-[14px] text-muted-foreground';

export const authErrorClass =
  'rounded-md border border-destructive/30 bg-danger-subtle px-3 py-2.5 text-sm text-danger-text';

export const authSuccessClass =
  'rounded-md border border-success/30 bg-success-subtle px-3 py-2.5 text-sm text-success-text';
