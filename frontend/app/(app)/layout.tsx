"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { useMeQuery } from "@/lib/hooks/auth/useMeQuery";
import { getDisplayName, type AuthUser } from "@/lib/api/authApi";
import { getDashboardPath } from "@/lib/auth/redirects";
import { StoreProvider } from "@/lib/kali/store/StoreProvider";
import { useStore } from "@/lib/kali/store/useStore";
import AppShell from "@/components/kali/layout/AppShell";
import ErrorBoundary from "@/components/kali/shared/ErrorBoundary";
import ToastProvider from "@/components/kali/shared/Toast";
import Loading from "../loading";

function ErrorToast() {
  const { error, dismissError } = useStore();
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

/**
 * Blocks the app until the session is known, and hands the signed-in account to
 * the tree below.
 *
 * A render prop rather than plain children because the name has to reach
 * StoreProvider, and the query that produced it lives here — the gate is the
 * only place that knows who is signed in, and the store is deliberately
 * ignorant of auth.
 */
function AuthGate({
  children,
}: {
  children: (user: AuthUser) => React.ReactNode;
}) {
  const router = useRouter();
  const { data, isLoading, isFetching, isError, isSuccess } = useMeQuery();

  const isRedirecting = isError || (isSuccess && data.user.type !== "user");

  useEffect(() => {
    if (isError) {
      router.replace("/sign-in");
      return;
    }

    if (!isSuccess) return;

    if (data.user.type !== "user") {
      router.replace(getDashboardPath(data.user.type));
    }
  }, [data, isError, isSuccess, router]);

  if (isLoading || isFetching || isRedirecting || !data) return <Loading />;

  return <>{children(data.user)}</>;
}

function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="kali-app">
      <AppShell>
        <ErrorBoundary>{children}</ErrorBoundary>
      </AppShell>
      <ErrorToast />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      {(user) => (
        <StoreProvider
          currentUser={{
            id: user.id,
            name: getDisplayName(user),
            workspaceId: user.workspaceId ?? null,
          }}
        >
          <ToastProvider>
            <AppFrame>{children}</AppFrame>
          </ToastProvider>
        </StoreProvider>
      )}
    </AuthGate>
  );
}
