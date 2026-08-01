import type { Metadata } from 'next'
import { AdminProvider } from '@/contexts/AdminContext'
import { AdminGate } from '@/components/admin/AdminGate'

export const metadata: Metadata = {
  title: 'Admin | F3 Norcal',
  // Keep the panel out of search results and off anyone's home screen.
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminGate>{children}</AdminGate>
    </AdminProvider>
  )
}
