/**
 * The mascot run-cycle, in playback order — the twelve frames of
 * public/assets/Loading, all sharing one square (362x362) canvas so they can be
 * stacked and crossfaded without the drawing shifting between poses.
 *
 * This lives in a plain module rather than in components/auth/LoadingScreen.tsx
 * so the root layout, which is a server component, can preload the files with
 * <link rel="preload">. The frames render with `unoptimized`, so the URL
 * preloaded here is byte-for-byte the URL the <img> requests and the browser
 * cache genuinely satisfies it.
 */
export const LOADING_FRAMES = [
  '/assets/Loading/loading_frame_01.png',
  '/assets/Loading/loading_frame_02.png',
  '/assets/Loading/loading_frame_03.png',
  '/assets/Loading/loading_frame_04.png',
  '/assets/Loading/loading_frame_05.png',
  '/assets/Loading/loading_frame_06.png',
  '/assets/Loading/loading_frame_07.png',
  '/assets/Loading/loading_frame_08.png',
  '/assets/Loading/loading_frame_09.png',
  '/assets/Loading/loading_frame_10.png',
  '/assets/Loading/loading_frame_11.png',
  '/assets/Loading/loading_frame_12.png',
] as const;
