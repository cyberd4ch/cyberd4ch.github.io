import type { Metadata, Viewport } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

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
    { media: '(prefers-color-scheme: light)', color: '#f7f6f3' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0e0d' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="min-h-screen flex flex-col max-w-[680px] mx-auto px-6 pt-6 pb-8">
          <Nav />
          <main className="flex-1 mt-6">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  )
}
