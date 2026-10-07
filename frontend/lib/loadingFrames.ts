/**
 * The mascot run-cycle, in playback order — the four frames of
 * public/assets/Loading, all sharing one canvas so they can be stacked and
 * crossfaded without the drawing shifting between poses.
 *
 * This lives in a plain module rather than in components/auth/LoadingScreen.tsx
 * so the root layout, which is a server component, can preload the files with
 * <link rel="preload">. The frames render with `unoptimized`, so the URL
 * preloaded here is byte-for-byte the URL the <img> requests and the browser
 * cache genuinely satisfies it.
 */
export const LOADING_FRAMES = [
  '/assets/Loading/fluely_loading_frame1.png',
  '/assets/Loading/fluely_loading_frame2.png',
  '/assets/Loading/fluely_loading_frame3.png',
  '/assets/Loading/fluely_loading_frame4.png',
] as const;
