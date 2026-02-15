import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Slide Builder',
  description: 'Event slide generator — 1920×1080 & 1080×1920',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
