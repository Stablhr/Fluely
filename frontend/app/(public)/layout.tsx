import Link from 'next/link';
import {BrandLogo} from '@/components/brand/Logo';
import {BRAND} from '@/lib/brand';

export default function PublicLayout({children}: {children: React.ReactNode}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/landing" aria-label={`${BRAND.name} home`}>
            <BrandLogo size={26} textClassName="text-[16px] text-foreground" />
          </Link>
          <nav className="flex items-center gap-5">
            <Link
              href="/sign-in"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="btn-sheen rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
