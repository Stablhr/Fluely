import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import {cn} from '@/lib/utils';
import {BRAND} from '@/lib/brand';
import ReactQueryProvider from '@/lib/provider/ReactQueryProvider';
import LoadingScreenProvider from '@/lib/provider/LoadingScreenProvider';
import {DISPLAY_INIT_SCRIPT} from '@/lib/theme/theme';
import {ThemeSync} from '@/lib/theme/useTheme';

/* One UI typeface for the whole product, plus its mono companion for code and
   tabular figures. */
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
});

export const metadata: Metadata = {
  metadataBase: new URL('https://fluely.vercel.app'),
  title: {default: BRAND.name, template: `%s · ${BRAND.name}`},
  description: BRAND.description,
  icons: {
    icon: [{url: '/assets/brand_mark.svg', type: 'image/svg+xml'}]
  },
  openGraph: {
    title: BRAND.name,
    description: BRAND.description,
    url: 'https://fluely.vercel.app/',
    type: 'website'
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // The theme script below adds `dark` and a color-scheme before hydration,
      // so the server and client attributes on <html> legitimately differ.
      suppressHydrationWarning
      className={cn('h-full', 'antialiased', geistSans.variable, geistMono.variable, 'font-sans')}
    >
      <head>
        {/* Applies the saved theme, motion, and density before first paint. */}
        <script dangerouslySetInnerHTML={{__html: DISPLAY_INIT_SCRIPT}} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeSync />
        <ReactQueryProvider>
          <LoadingScreenProvider>{children}</LoadingScreenProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
