'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {usePathname} from 'next/navigation';
import LoadingScreen, {
  preloadLoadingFrames,
  type LoadingScreenMode,
} from '@/components/auth/LoadingScreen';
import {CURTAIN_FADE_OUT_MS} from '@/lib/auth/loadingCurtain';

type LoadingScreenContextValue = {
  mode: LoadingScreenMode;
  show: (mode: LoadingScreenMode) => void;
  hide: () => void;
};

const LoadingScreenContext = createContext<LoadingScreenContextValue | null>(
  null
);

/**
 * Owns the one loading curtain used for the auth requests — the sign-in form,
 * both sign-out buttons, and the redirect that follows either. Mounted in the
 * root layout because the trigger lives in the (auth) group but sign-out lives
 * in (app) and (admin).
 *
 * The curtain is mounted only while active rather than hidden with CSS, so the
 * frame interval starts fresh on every show and nothing is left ticking behind
 * a hidden overlay.
 *
 * It is NOT raised for the initial page load. That case belongs to
 * app/loading.tsx, which renders the same curtain as the route's Suspense
 * fallback. The provider used to open its own curtain on mount as well, and
 * during the overlap the two mascots ran at independent offsets — so on screen
 * there were two drawings crossfading at half opacity on top of each other,
 * which reads as a blur rather than a run cycle. One curtain at a time fixes
 * that, and app/loading.tsx is in the server HTML too, so a refresh still shows
 * the mascot in the first flush rather than a bare ivory page.
 */
export default function LoadingScreenProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [active, setActive] = useState<LoadingScreenMode | null>(null);
  const [exiting, setExiting] = useState(false);
  const pathname = usePathname();

  /* Which route the current curtain was raised on, so a navigation can retire
     it. Null while no curtain is up. */
  const raisedOn = useRef<string | null>(null);
  /* Timer for the fade-out, so a curtain that is reopened mid-fade snaps back
     instead of unmounting underneath the new request. Doubles as the guard
     against scheduling a second retirement while one is counting down. */
  const exitTimer = useRef<number | null>(null);

  const cancelExit = useCallback(() => {
    if (exitTimer.current === null) return;
    window.clearTimeout(exitTimer.current);
    exitTimer.current = null;
    setExiting(false);
  }, []);

  /* Warm the mascot frames on app mount so the curtain never opens on an empty
     box, however slow the connection is when the user hits sign in. The root
     layout also preloads them via <link rel="preload">; this is the belt to
     that braces. Fire-and-forget — the boot curtain that used to wait on this
     promise is gone, and nothing else needs the result. */
  useEffect(() => {
    void preloadLoadingFrames();
  }, []);

  useEffect(() => {
    return () => {
      if (exitTimer.current !== null) {
        window.clearTimeout(exitTimer.current);
      }
    };
  }, []);

  /**
   * Start the fade-out and unmount once it has run. The curtain stays mounted
   * for the length of the transition, so `hide()` is still synchronous and the
   * auth callers keep their existing shape.
   */
  const dismiss = useCallback(() => {
    /* A retirement is already counting down. */
    if (exitTimer.current !== null) return;

    setExiting(true);
    exitTimer.current = window.setTimeout(() => {
      exitTimer.current = null;
      setExiting(false);
      setActive(null);
    }, CURTAIN_FADE_OUT_MS);
  }, []);

  const show = useCallback(
    (mode: LoadingScreenMode) => {
      cancelExit();
      raisedOn.current = pathname;
      setActive(mode);
    },
    [pathname, cancelExit]
  );

  const hide = useCallback(() => {
    raisedOn.current = null;
    dismiss();
  }, [dismiss]);

  /* Sign-in deliberately leaves the curtain up across its redirect so the
     dashboard cannot flash in behind it. That only works if something retires
     it afterwards, and because router.push is a client-side navigation this
     provider in the root layout never unmounts — so drop the sign-in curtain as
     soon as the app is actually on a different route than the one that raised
     it.

     Only the sign-in handoff is retired this way. Sign-out owns its own timing
     inside useSignOut (hold, then hide) and must not be second-guessed here: the
     (app) auth gate replaces to /sign-in the moment the session goes stale,
     which lands while that hold is still counting, and retiring the curtain
     there would cut the sign-out animation short. */
  useEffect(() => {
    if (raisedOn.current && raisedOn.current !== pathname) {
      raisedOn.current = null;
      dismiss();
    }
  }, [pathname, dismiss]);

  const value = useMemo<LoadingScreenContextValue>(
    () => ({mode: active ?? 'login', show, hide}),
    [active, show, hide]
  );

  return (
    <LoadingScreenContext.Provider value={value}>
      {children}
      {active && <LoadingScreen mode={active} exiting={exiting} />}
    </LoadingScreenContext.Provider>
  );
}

export function useLoadingScreen() {
  const context = useContext(LoadingScreenContext);

  if (!context) {
    throw new Error(
      'useLoadingScreen must be used within a LoadingScreenProvider'
    );
  }

  return context;
}
