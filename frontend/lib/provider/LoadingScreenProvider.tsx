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

type LoadingScreenContextValue = {
  mode: LoadingScreenMode;
  show: (mode: LoadingScreenMode) => void;
  hide: () => void;
};

const LoadingScreenContext = createContext<LoadingScreenContextValue | null>(
  null
);

/**
 * The curtain is up for the very first render, which is also the very first
 * render the server sends. That is what makes a refresh show the mascot
 * instead of a bare ivory page: the HTML arriving before the JS bundle carries
 * the overlay with it, so there is no blank gap while the chunk parses and
 * React hydrates.
 */
const BOOT_MODE: LoadingScreenMode = 'load';

/**
 * Upper bound on how long the boot curtain will wait for the mascot frames. The
 * curtain would rather lift on an empty box than never lift at all.
 */
const BOOT_CURTAIN_MAX_MS = 1200;

/**
 * Owns the one loading curtain so the sign-in form, both sign-out buttons, and
 * the initial page load can share it. Mounted in the root layout because the
 * trigger lives in the (auth) group but sign-out lives in (app) and (admin).
 *
 * The curtain is mounted only while active rather than hidden with CSS, so the
 * frame interval starts fresh on every show and nothing is left ticking behind
 * a hidden overlay.
 */
export default function LoadingScreenProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [active, setActive] = useState<LoadingScreenMode | null>(BOOT_MODE);
  const pathname = usePathname();
  /* Which route the current curtain was raised on, so a navigation can retire
     it. Null while no curtain is up. */
  const raisedOn = useRef<string | null>(null);

  /* Warm the mascot frames on app mount so the curtain never opens on an empty
     box, however slow the connection is when the user hits sign in. The root
     layout also preloads them via <link rel="preload">; this is the belt to
     that braces, and it doubles as the signal for when the mascot is ready. */
  useEffect(() => {
    let settled = false;

    const retire = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(cap);
      // The guard matters: a real request can claim the curtain during the
      // boot window, and this must not cancel it.
      setActive((current) => (current === BOOT_MODE ? null : current));
    };

    const cap = window.setTimeout(retire, BOOT_CURTAIN_MAX_MS);

    preloadLoadingFrames().then(() => {
      /* Wait for the first client render as well, so the real page is on screen
         before the overlay lifts rather than flashing curtain-then-content. */
      window.setTimeout(retire, 0);
    });

    return () => {
      settled = true;
      window.clearTimeout(cap);
    };
  }, []);

  const show = useCallback(
    (mode: LoadingScreenMode) => {
      raisedOn.current = pathname;
      setActive(mode);
    },
    [pathname]
  );

  const hide = useCallback(() => {
    raisedOn.current = null;
    setActive(null);
  }, []);

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
     there would cut the sign-out animation short. The boot curtain likewise
     belongs to its own effect above. */
  useEffect(() => {
    if (raisedOn.current && raisedOn.current !== pathname) {
      raisedOn.current = null;
      setActive((current) => (current === 'login' ? null : current));
    }
  }, [pathname]);

  const value = useMemo<LoadingScreenContextValue>(
    () => ({mode: active ?? 'login', show, hide}),
    [active, show, hide]
  );

  return (
    <LoadingScreenContext.Provider value={value}>
      {children}
      {active && <LoadingScreen mode={active} />}
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
