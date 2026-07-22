import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'cyber.dach',
  description: 'Telecom engineer & cybersecurity expert. Building things at the intersection of networks, security, and software.',
  openGraph: {
    title: 'cyber.dach',
    description: 'Telecom engineer & cybersecurity expert.',
    url: 'https://cyberdach.dev',
    siteName: 'cyber.dach',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="min-h-screen flex flex-col max-w-[680px] mx-auto px-6 py-8">
          <Nav />
          <main className="flex-1 mt-12">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  )
}