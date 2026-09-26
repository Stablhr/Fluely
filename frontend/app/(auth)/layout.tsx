'use client';

import {useEffect} from 'react';
import Image from 'next/image';
import {useRouter} from 'next/navigation';
import {useMeQuery} from '@/lib/hooks/auth/useMeQuery';
import {getDashboardPath} from '@/lib/auth/redirects';
import Loading from '../loading';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout = ({children}: AuthLayoutProps) => {
  const router = useRouter();
  const {data, isLoading, isFetching, isSuccess} = useMeQuery();

  useEffect(() => {
    if (!isSuccess) return;
    router.replace(getDashboardPath(data.user.type));
  }, [data, isSuccess, router]);

  if (isLoading || isFetching) return <Loading />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 font-body sm:p-6 lg:p-10">
      {/* The card clips its own corners, so the brand panel below can sit flush
          against the left edge and still pick up the rounded outer corners. */}
      <div className="grid w-full max-w-[920px] overflow-hidden rounded-hero bg-card shadow-2xl shadow-brand-ink/10 md:grid-cols-2">
        <div className="relative hidden overflow-hidden bg-brand-blue p-7 md:flex md:flex-col md:justify-between sm:p-9 lg:p-12">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-28 -left-20 h-72 w-72 rounded-full bg-brand-green/80 blur-3xl" />
            <div className="absolute -top-16 -right-24 h-80 w-80 rounded-full bg-brand-vanilla/70 blur-3xl" />
            <div className="absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-brand-vanilla/75 blur-3xl" />
            <div className="absolute -right-20 -bottom-16 h-72 w-72 rounded-full bg-brand-green/60 blur-3xl" />
            <div className="absolute inset-0 bg-linear-to-br from-brand-blue/80 via-transparent to-blue-deep/70" />
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-ivory/90">
              <Image
                src="/assets/fluely_logo.png"
                alt=""
                width={28}
                height={28}
                aria-hidden
                className="h-7 w-7 rounded-lg object-contain"
              />
            </span>
            <span className="font-heading text-[17px] font-bold tracking-tight text-brand-ivory">
              Fluely
            </span>
          </div>

          <div className="relative z-10">
            <h1 className="max-w-xs font-heading text-4xl font-bold leading-tight text-brand-ivory">
              Fluely
            </h1>
            <p className="mt-3 max-w-xs font-body text-[15px] leading-relaxed text-brand-ivory/80">
              Plan your tasks, organize your boards, and stay on top of your week — all in one place.
            </p>
          </div>
        </div>

        <div className="p-7 sm:p-9 lg:p-12">
          <div className="mx-auto w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
