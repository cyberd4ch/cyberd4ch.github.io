import type { Metadata, Viewport } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import Reveal from '@/components/Reveal'
import FlightCanvas from '@/components/flight/FlightCanvas'
import ShipCanvas from '@/components/ships/ShipCanvas'

export const metadata: Metadata = {
  metadataBase: new URL('https://cyberdach.dev'),
  title: 'cyber.dach',
  description:
    'Telecom engineer & cybersecurity expert. Building things at the intersection of networks, security, and software.',
  openGraph: {
    title: 'cyber.dach',
    description:
      'Telecom engineer & cybersecurity expert. Networks, security, and software — pulled live from GitHub.',
    url: 'https://cyberdach.dev',
    siteName: 'cyber.dach',
    images: [
      {
        url: '/og-card.png',
        width: 1280,
        height: 640,
        alt: 'cyber.dach — the orbit-d mark among stars',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'cyber.dach',
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
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#101012' },
  ],
}

/**
 * Pre-paint theme + stage init, inline so there is no flash of the wrong
 * scheme. github.io serves no Content-Security-Policy, so an inline script
 * is safe here. It applies the stored theme mode (system/light/dark) and,
 * on the home route on a phone, locks the document for the presentation
 * stage before DeckStage hydrates — no flash of un-styled stacked sections.
 */
const themeInit = `(function(){
try{
var K='theme',m;try{m=localStorage.getItem(K)}catch(e){}
if(m!=='light'&&m!=='dark')m='system';
var r=document.documentElement,q=window.matchMedia('(prefers-color-scheme: dark)');
var d=m==='dark'||(m==='system'&&q.matches);
r.dataset.theme=m;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';
var sync=function(){var m2;try{m2=localStorage.getItem(K)}catch(e){}
if(m2!=='light'&&m2!=='dark')m2='system';
if(m2==='system'){var d2=q.matches;r.classList.toggle('dark',d2);r.style.colorScheme=d2?'dark':'light';}};
if(q.addEventListener)q.addEventListener('change',sync);else if(q.addListener)q.addListener(sync);
}catch(e){}
try{
if(location.pathname==='/'&&window.matchMedia('(max-width: 767.98px)').matches&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
document.documentElement.dataset.stage='on';
}
}catch(e){}
})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* fixed flight layer: scroll-scrubbed aircraft, behind the app layer */}
        <FlightCanvas />
        <Reveal />
        {/* fixed ship fleet: above the app layer — portrait + scatter */}
        <ShipCanvas />

        <div className="relative z-[1] flex min-h-screen flex-col">
          <Nav />

          {/* pages own their column (home places the full-bleed hero first) */}
          <main className="flex-1">{children}</main>

          <div className="page-col footer-col mx-auto mt-16 w-full max-w-[680px] px-6 pb-8">
            <Footer />
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: themeInit }} />

        {/* no JS: never hide revealed content */}
        <noscript>
          <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </body>
    </html>
  )
}
