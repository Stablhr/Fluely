'use client';

import {useCallback} from 'react';
import {useRouter} from 'next/navigation';
import {useLogout} from './useLogout';
import {useLoadingScreen} from '@/lib/provider/LoadingScreenProvider';

/**
 * The sign-out API is usually faster than one pass of the mascot animation, so
 * without a floor the curtain would flash for a single frame and read as a
 * glitch. Hold it long enough to be legible.
 */
const MIN_LOGOUT_MS = 1000;

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Sign-out with the shared loading curtain: raise the overlay immediately, keep
 * it up for at least MIN_LOGOUT_MS, then dismiss and route to sign-in.
 *
 * Both the sidebar (components/kali/layout/Sidebar.tsx) and the admin dashboard
 * go through here so the timing and the redirect stay in one place. The
 * mutation state is still exposed for the caller's button label and disabled
 * state.
 */
export function useSignOut() {
  const router = useRouter();
  const logout = useLogout();
  const {show, hide} = useLoadingScreen();

  const signOut = useCallback(async () => {
    show('logout');
    const startedAt = Date.now();

    try {
      await logout.mutateAsync();
    } finally {
      // A failed sign-out still lands on sign-in, matching the previous
      // onSettled behaviour, so a stale session cannot pin the user in the app.
      const remaining = MIN_LOGOUT_MS - (Date.now() - startedAt);
      if (remaining > 0) await wait(remaining);

      hide();
      router.replace('/sign-in');
    }
  }, [logout, router, show, hide]);

  return {...logout, signOut};
}
