import type { Metadata } from 'next'
import { Gloock, Hanken_Grotesk } from 'next/font/google'
import { Header } from '@/components/Header'
import { ToastProvider } from '@/components/Toast'
import { MotionPreferences } from '@/components/MotionPreferences'
import { SmoothScroll } from '@/components/SmoothScroll'
import './globals.css'

const gloock = Gloock({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const hankenGrotesk = Hanken_Grotesk({
  weight: 'variable',
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Darpan — picture jewellery on you.',
  description: 'Explore jewellery on your photo, compare proportions and save a choice with clear sizing estimates.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${gloock.variable} ${hankenGrotesk.variable}`}>
      <body className="antialiased min-h-screen bg-[var(--bg)] text-[var(--ink)]">
        <MotionPreferences><ToastProvider><SmoothScroll>
          <Header />
          <div className="site-content">{children}</div>
        </SmoothScroll></ToastProvider></MotionPreferences>
      </body>
    </html>
  )
}
