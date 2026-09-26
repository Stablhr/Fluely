'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
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
 * Owns the one auth loading curtain so the sign-in form and both sign-out
 * buttons can share it. Mounted in the root layout because the trigger lives in
 * the (auth) group but sign-out lives in (app) and (admin).
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
  const [active, setActive] = useState<LoadingScreenMode | null>(null);

  /* Warm the mascot frames on app mount so the curtain never opens on an empty
     box, however slow the connection is when the user hits sign in. */
  useEffect(() => {
    preloadLoadingFrames();
  }, []);

  const show = useCallback((mode: LoadingScreenMode) => setActive(mode), []);
  const hide = useCallback(() => setActive(null), []);

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
