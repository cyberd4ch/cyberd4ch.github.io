import type { Metadata, Viewport } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import Reveal from '@/components/Reveal'
import PaintCanvas from '@/components/paint/PaintCanvas'

export const metadata: Metadata = {
  metadataBase: new URL('https://cyberdach.dev'),
  title: 'cyber.dach — mission control',
  description:
    'Telecom engineer & cybersecurity expert. Building things at the intersection of networks, security, and software.',
  openGraph: {
    title: 'cyber.dach — mission control',
    description:
      'Telecom engineer & cybersecurity expert. Networks, security, and software — pulled live from GitHub.',
    url: 'https://cyberdach.dev',
    siteName: 'cyber.dach',
    images: [
      {
        url: '/og-card.png',
        width: 1280,
        height: 640,
        alt: 'cyber.dach — mission control: the orbit-d mark among stars',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'cyber.dach — mission control',
    description: 'Telecom engineer & cybersecurity expert.',
    images: ['/og-card.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5efe1' },
    { media: '(prefers-color-scheme: dark)', color: '#070c16' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* fixed paint layer: behind the app layer, over the blueprint grid */}
        <PaintCanvas />
        <Reveal />

        <div className="relative z-[1] flex min-h-screen flex-col">
          <div className="page-col mx-auto w-full max-w-[680px] px-6 pt-6 pb-5">
            <Nav />
          </div>

          {/* pages own their column (home places the full-bleed hero first) */}
          <main className="flex-1">{children}</main>

          <div className="page-col mx-auto mt-16 w-full max-w-[680px] px-6 pb-8">
            <Footer />
          </div>
        </div>

        {/* no JS: never hide revealed content */}
        <noscript>
          <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </body>
    </html>
  )
}
