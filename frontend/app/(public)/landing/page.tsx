import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  CalendarRange,
  Columns3,
  Images,
  Send,
  Users
} from 'lucide-react';

const FEATURES = [
  {
    icon: Columns3,
    title: 'Boards',
    description: 'Lists, cards, labels, due dates, and attachments for every project your team runs.'
  },
  {
    icon: CalendarRange,
    title: 'Schedule',
    description: 'See deadlines across every board on one weekly calendar and plan around them.'
  },
  {
    icon: Send,
    title: 'Social planner',
    description: 'Draft, review, and schedule posts for Instagram, Facebook, TikTok, and YouTube.'
  },
  {
    icon: Users,
    title: 'Collaboration',
    description: 'Invite teammates as editors or viewers, comment on cards, and mention people.'
  },
  {
    icon: Bell,
    title: 'Notifications',
    description: 'Stay on top of invitations, mentions, and changes without chasing updates.'
  },
  {
    icon: Images,
    title: 'Media library',
    description: 'Keep images and video with the cards and posts they belong to.'
  }
];

const PREVIEW_LISTS = [
  {name: 'To do', cards: [{t: 'Q3 campaign brief', l: 'bg-violet-600'}, {t: 'Product photos', l: 'bg-orange-700'}]},
  {name: 'In progress', cards: [{t: 'Launch post copy', l: 'bg-primary'}, {t: 'Landing page review', l: 'bg-sky-700'}]},
  {name: 'Scheduled', cards: [{t: 'Instagram carousel', l: 'bg-rose-700'}]}
];

function ProductPreview() {
  return (
    <div
      aria-hidden
      className="mx-auto mt-16 max-w-5xl overflow-hidden rounded-xl text-left border border-border bg-card shadow-xl shadow-black/5"
    >
      <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="ml-3 text-xs text-muted-foreground">Marketing · Board</span>
      </div>
      <div className="flex">
        <div className="hidden w-44 shrink-0 space-y-1 border-r border-border p-3 sm:block">
          {['Dashboard', 'Boards', 'Schedule', 'Social posting', 'Settings'].map((item, i) => (
            <div
              key={item}
              className={`rounded-md px-2.5 py-1.5 text-xs ${
                i === 1 ? 'bg-primary-subtle font-medium text-primary-text' : 'text-muted-foreground'
              }`}
            >
              {item}
            </div>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-1 gap-3 bg-background p-4 sm:grid-cols-3">
          {PREVIEW_LISTS.map((list) => (
            <div key={list.name} className="rounded-lg bg-muted p-2.5">
              <p className="px-1 text-xs font-semibold text-foreground">{list.name}</p>
              <div className="mt-2 space-y-2">
                {list.cards.map((card) => (
                  <div key={card.t} className="rounded-md border border-border bg-card p-2.5 shadow-sm">
                    <span className={`block h-1 w-8 rounded-full ${card.l}`} />
                    <p className="mt-2 text-xs font-medium text-foreground">{card.t}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="px-6 pt-24 pb-20 text-center sm:pt-28">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-medium text-primary-text">Projects and content in one workspace</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Plan the work.
            <br />
            Schedule the content.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Fluely brings your team&apos;s boards, deadlines, and social calendar together, so
            nothing ships late and nothing posts by surprise.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Create free account
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/sign-in"
              className="rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Sign in
            </Link>
          </div>
        </div>
        <ProductPreview />
      </section>

      {/* Features */}
      <section className="border-t border-border bg-card px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight">Everything your team plans, in one place</h2>
            <p className="mt-3 text-muted-foreground">
              Replace the spreadsheet, the task app, and the content calendar with one tool.
            </p>
          </div>
          <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({icon: Icon, title, description}) => (
              <div key={title}>
                <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-primary-text">
                  <Icon size={18} />
                </span>
                <h3 className="mt-4 text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Get your team on one plan</h2>
          <p className="mt-4 text-muted-foreground">
            Create a workspace in a minute and invite your teammates when you&apos;re ready.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              href="/sign-up"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Create free account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Fluely</p>
          <div className="flex gap-6">
            <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">
              Developer docs
            </Link>
            <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
