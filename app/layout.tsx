import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { ToastContainer } from '@/components/ui/Toast'

export const metadata: Metadata = {
  title: 'מנהל מבנה האתר',
  description: 'Colman Site Structure Manager v2',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <AuthProvider>{children}</AuthProvider>
        <ToastContainer />
      </body>
    </html>
  )
}
