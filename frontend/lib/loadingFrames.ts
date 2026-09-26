/**
 * The mascot run-cycle in playback order: 1 mid-leap, 2 upright peak,
 * 3 leaning run, 4 running.
 *
 * This lives in a plain module rather than in components/auth/LoadingScreen.tsx
 * so the root layout, which is a server component, can preload the files with
 * <link rel="preload">. The frames render with `unoptimized`, so the URL
 * preloaded here is byte-for-byte the URL the <img> requests and the browser
 * cache genuinely satisfies it.
 */
export const LOADING_FRAMES = [
  '/assets/Loading/fluely_action_frame_1.png',
  '/assets/Loading/fluely_action_frame_2.png',
  '/assets/Loading/fluely_action_frame_3.png',
  '/assets/Loading/fluely_action_frame_4.png',
] as const;
