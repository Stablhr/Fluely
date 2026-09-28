/**
 * Shared floor for how long the loading curtain stays on screen.
 *
 * The auth requests are usually faster than one pass of the mascot animation,
 * so without a floor the curtain would flash for a single frame and read as a
 * glitch rather than as feedback. Sign-in and sign-out both hold for at least
 * this long; the constant lives here so the two flows cannot drift apart.
 *
 * The frame swap rate is deliberately NOT part of this module — the animation
 * itself still runs at its own per-frame interval (see
 * components/auth/LoadingScreen.tsx). Only the curtain's own timings live here.
 */
export const MIN_CURTAIN_MS = 1000;

/**
 * How long the curtain takes to fade out once the page it is covering is ready.
 *
 * The number is consumed in two places — as the CSS transition-duration on the
 * overlay and as the timer the provider waits out before unmounting — so it
 * lives here rather than being inlined at each site. If the two disagree the
 * curtain is either unmounted mid-fade (a visible cut) or left on screen fully
 * transparent, briefly swallowing clicks.
 */
export const CURTAIN_FADE_OUT_MS = 420;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Resolve once MIN_CURTAIN_MS has elapsed since `startedAt`, waiting out the
 * remainder if the request already finished sooner.
 *
 * Pass `Date.now()` taken at the moment the curtain was raised. If the request
 * turned out to be slower than the floor, this resolves immediately and adds
 * no delay of its own.
 */
export async function holdForMinimum(startedAt: number) {
  const remaining = MIN_CURTAIN_MS - (Date.now() - startedAt);
  if (remaining > 0) await wait(remaining);
}
