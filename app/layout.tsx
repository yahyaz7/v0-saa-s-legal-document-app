import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { MuiThemeProvider } from '@/components/mui-theme-provider'
import { StaffShell } from '@/components/staff-shell'
import { AppProvider } from '@/lib/app-context'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: 'LegalDocs Pro - Document Automation',
  description: 'Professional document automation for UK law firms',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <MuiThemeProvider>
          <AppProvider>
            <StaffShell>{children}</StaffShell>
          </AppProvider>
        </MuiThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
