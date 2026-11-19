import Link from 'next/link';
import type {ReactNode} from 'react';
import {BRAND} from '@/lib/brand';

/**
 * Shared layout for the public legal pages (privacy, terms). Social platforms
 * review these URLs when approving the app, so they must stay reachable
 * without signing in -- they live under the `(public)` route group.
 */

export const LEGAL_CONTACT = 'support@fluely.app';
export const LEGAL_UPDATED = '19 November 2026';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

export function LegalPage({
  title,
  intro,
  sections
}: {
  title: string;
  intro: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">{BRAND.name}</p>
      <h1 className="mt-2 font-heading text-3xl font-semibold text-foreground sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {LEGAL_UPDATED}</p>
      <div className="mt-6 text-[15px] leading-relaxed text-muted-foreground">{intro}</div>

      <nav aria-label="On this page" className="mt-8 rounded-lg border border-border bg-surface-alt p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">On this page</p>
        <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-foreground hover:text-primary">
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-10">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-20">
            <h2 className="font-heading text-xl font-semibold text-foreground">
              {i + 1}. {s.title}
            </h2>
            <div className="legal-body mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground [&_ul]:space-y-1.5">
              {s.body}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-sm text-muted-foreground">
        <Link href="/privacy" className="hover:text-foreground">Privacy policy</Link>
        <Link href="/terms" className="hover:text-foreground">Terms of service</Link>
        <Link href="/privacy#data-deletion" className="hover:text-foreground">Delete your data</Link>
        <a href={`mailto:${LEGAL_CONTACT}`} className="hover:text-foreground">{LEGAL_CONTACT}</a>
      </footer>
    </div>
  );
}
