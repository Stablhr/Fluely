import type {Metadata} from 'next';
import {Geist, Geist_Mono, JetBrains_Mono, Poppins, Comfortaa} from 'next/font/google';
import './globals.css';
import {cn} from '@/lib/utils';
import ReactQueryProvider from '@/lib/provider/ReactQueryProvider';
import LoadingScreenProvider from '@/lib/provider/LoadingScreenProvider';
import {LOADING_FRAMES} from '@/lib/loadingFrames';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono'
});

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
});

/* So Matcha brand faces — Poppins for headings and numerals, Comfortaa for
   body copy. Exposed as --font-poppins / --font-comfortaa so the theme layer
   can publish them as the font-heading and font-body utilities. */
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-poppins'
});

const comfortaa = Comfortaa({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-comfortaa'
});

export const metadata: Metadata = {
  metadataBase: new URL('https://yourdomain.vercel.app'), // Replace with your actual URL
  title: 'Fluely',
  description: 'Project-Management System with Social Media Content Planner',
  icons: {
    // The supplied favicon asset is 413x604 rather than a square icon, so the
    // real intrinsic size is declared instead of invented 32x32/192x192 hints.
    icon: [{url: '/assets/fluely_favicon.png', type: 'image/png', sizes: '413x604'}],
    apple: '/assets/fluely_favicon.png'
  },
  openGraph: {
    title: 'Fluely',
    description: 'Project-Management and Social Media Planner',
    url: 'https://yourdomain.vercel.app/',
    type: 'website',
    images: [
      {
        url: '/assets/fluely_logo.png',
        width: 589,
        height: 423,
        alt: 'Fluely'
      }
    ]
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
      className={cn(
        'h-full',
        'antialiased',
        geistSans.variable,
        geistMono.variable,
        'font-mono',
        jetbrainsMono.variable,
        poppins.variable,
        comfortaa.variable
      )}
    >
      <head>
        {/* The boot curtain is part of the server HTML, so its mascot frames are
            requested in parallel with the bundle rather than after hydration.
            These are the same URLs the <img> uses, so the preloads are hits. */}
        {LOADING_FRAMES.map((src) => (
          <link key={src} rel="preload" as="image" href={src} />
        ))}
      </head>
      <body className="min-h-full flex flex-col">
        <ReactQueryProvider>
          <LoadingScreenProvider>{children}</LoadingScreenProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
