'use client';

import {useCallback} from 'react';
import {useRouter} from 'next/navigation';
import {useLogout} from './useLogout';
import {useLoadingScreen} from '@/lib/provider/LoadingScreenProvider';
import {holdForMinimum} from '@/lib/auth/loadingCurtain';

/**
 * Sign-out with the shared loading curtain: raise the overlay immediately, keep
 * it up for at least MIN_CURTAIN_MS, then dismiss and route to sign-in.
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
      await holdForMinimum(startedAt);

      hide();
      router.replace('/sign-in');
    }
  }, [logout, router, show, hide]);

  return {...logout, signOut};
}
