'use client';

import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {CalendarRange, Columns3, Users} from 'lucide-react';
import {useMeQuery} from '@/lib/hooks/auth/useMeQuery';
import {getDashboardPath} from '@/lib/auth/redirects';
import {BRAND} from '@/lib/brand';
import {BrandLogo} from '@/components/brand/Logo';
import Loading from '../loading';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const HIGHLIGHTS = [
  {icon: Columns3, text: 'Boards, lists, and cards for every project'},
  {icon: CalendarRange, text: 'One calendar for tasks and scheduled posts'},
  {icon: Users, text: 'Shared workspaces with roles and invitations'}
];

const AuthLayout = ({children}: AuthLayoutProps) => {
  const router = useRouter();
  const {data, isLoading, isFetching, isSuccess} = useMeQuery();

  useEffect(() => {
    if (!isSuccess) return;
    router.replace(getDashboardPath(data.user.type));
  }, [data, isSuccess, router]);

  if (isLoading || isFetching) return <Loading />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 sm:px-6 lg:px-10">
      <div className="animate-dialog grid w-full max-w-[960px] overflow-hidden rounded-xl border border-border bg-card shadow-sm md:grid-cols-[1fr_1.1fr]">
        {/* Brand panel: always dark slate, in both themes, so it reads as a
            fixed frame around the form rather than part of the page. */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-10 text-white md:flex">
          {/* A grid that fades toward the bottom, a cobalt glow, and a beam of
              light that sweeps down across the grid every few seconds. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
              backgroundSize: '32px 32px',
              maskImage: 'radial-gradient(ellipse at 30% 20%, black 30%, transparent 75%)'
            }}
          />
          <div
            aria-hidden
            className="animate-halo pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-primary/40 blur-3xl"
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="animate-beam absolute inset-x-0 h-1/2 bg-linear-to-b from-transparent via-primary/15 to-transparent" />
          </div>

          <BrandLogo className="relative" textClassName="text-white" />

          <div className="stagger relative">
            <h1 className="max-w-sm text-[28px] font-semibold leading-tight tracking-tight">
              {BRAND.tagline}
            </h1>
            <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-slate-300">
              {BRAND.name} keeps your team&apos;s projects and social calendar in one place.
            </p>
            <ul className="stagger mt-8 space-y-3">
              {HIGHLIGHTS.map(({icon: Icon, text}) => (
                <li key={text} className="flex items-center gap-3 text-[14px] text-slate-200">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5">
                    <Icon size={16} />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-slate-400">
            © {new Date().getFullYear()} {BRAND.name}
          </p>
        </div>

        <div className="p-7 sm:p-10 lg:p-12">
          <BrandLogo className="mb-8 md:hidden" textClassName="text-foreground" />
          <div className="animate-rise mx-auto w-full max-w-sm" style={{animationDelay: '120ms'}}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
