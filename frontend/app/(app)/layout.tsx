'use client';

import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {AlertTriangle, X} from 'lucide-react';
import {useMeQuery} from '@/lib/hooks/auth/useMeQuery';
import {getDashboardPath} from '@/lib/auth/redirects';
import {StoreProvider} from '@/lib/kali/store/StoreProvider';
import {useStore} from '@/lib/kali/store/useStore';
import {useThemeMode} from '@/lib/kali/hooks/useThemeMode';
import AppShell from '@/components/kali/layout/AppShell';
import ErrorBoundary from '@/components/kali/shared/ErrorBoundary';
import ToastProvider from '@/components/kali/shared/Toast';
import Loading from '../loading';

function ErrorToast() {
  const {error, dismissError} = useStore();
  if (!error) return null;

  return (
    <div className="animate-in fixed bottom-4 left-1/2 z-[60] flex max-w-md -translate-x-1/2 items-center gap-2.5 rounded-lg border border-border-strong bg-surface-elevated px-4 py-2.5 text-sm font-medium text-text-primary shadow-medium">
      <AlertTriangle size={16} className="shrink-0 text-warning-text" />
      <span className="flex-1">{error}</span>
      <button
        type="button"
        onClick={dismissError}
        aria-label="Dismiss error"
        className="shrink-0 rounded-md p-0.5 text-text-secondary transition-colors duration-150 hover:text-text-primary"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function AuthGate({children}: {children: React.ReactNode}) {
  const router = useRouter();
  const {data, isLoading, isFetching, isError, isSuccess} = useMeQuery();

  const isRedirecting = isError || (isSuccess && data.user.type !== 'user');

  useEffect(() => {
    if (isError) {
      router.replace('/sign-in');
      return;
    }

    if (!isSuccess) return;

    if (data.user.type !== 'user') {
      router.replace(getDashboardPath(data.user.type));
    }
  }, [data, isError, isSuccess, router]);

  if (isLoading || isFetching || isRedirecting) return <Loading />;

  return <>{children}</>;
}

function AppFrame({children}: {children: React.ReactNode}) {
  useThemeMode();

  return (
    <div className="kali-app">
      <AppShell>
        <ErrorBoundary>{children}</ErrorBoundary>
      </AppShell>
      <ErrorToast />
    </div>
  );
}

export default function AppLayout({children}: {children: React.ReactNode}) {
  return (
    <AuthGate>
      <StoreProvider>
        <ToastProvider>
          <AppFrame>{children}</AppFrame>
        </ToastProvider>
      </StoreProvider>
    </AuthGate>
  );
}
