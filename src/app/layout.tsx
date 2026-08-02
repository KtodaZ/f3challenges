import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { Toaster } from 'sonner'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { CrashCapture } from '@/components/providers/CrashCapture'
import { AppShell } from '@/components/providers/AppShell'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  title: 'F3 Norcal | Monthly Challenge',
  description: 'Track and crush your F3 region\u2019s monthly fitness challenge with your crew.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Monthly Challenge',
  },
  formatDetection: { telephone: false },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-dvh antialiased">
        <QueryProvider>
          <TooltipProvider>
            <CrashCapture />
            {/* The PAX providers live in AppShell, which skips them under
                /admin — see the note there. */}
            <AppShell>{children}</AppShell>
            <Toaster
              position="bottom-center"
              offset="80px"
              toastOptions={{
                style: { background: '#27272a', border: '1px solid #3f3f46', color: '#fafafa' },
              }}
            />
          </TooltipProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
