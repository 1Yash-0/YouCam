import type { Metadata } from 'next'
import { Instrument_Serif } from 'next/font/google'
import { Header } from '@/components/Header'
import { ToastProvider } from '@/components/Toast'
import './globals.css'

const instrumentSerif = Instrument_Serif({
  weight: '400',
  style: 'italic',
  subsets: ['latin'],
  variable: '--font-instrument-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Darpan — See it at actual size',
  description: 'True-size jewellery, on you, before you buy. Real-size earring try-on measured against your own iris.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${instrumentSerif.variable}`}>
      <body className="antialiased min-h-screen bg-[var(--bg)] text-[var(--ink)]">
        <ToastProvider>
          <Header />
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
