/**
 * Shared floor for how long the loading curtain stays on screen.
 *
 * The auth requests are usually faster than one pass of the mascot animation,
 * so without a floor the curtain would flash for a single frame and read as a
 * glitch rather than as feedback. Sign-in and sign-out both hold for at least
 * this long; the constant lives here so the two flows cannot drift apart.
 *
 * The frame swap rate is deliberately NOT part of this module — the animation
 * itself still runs at 175ms per frame (see components/auth/LoadingScreen.tsx).
 * Only the minimum time the curtain is visible is governed here.
 */
export const MIN_CURTAIN_MS = 1000;

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
