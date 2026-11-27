'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, PanelsTopLeft } from 'lucide-react'
import { MotionConfig } from 'framer-motion'
import { useUser } from '@/components/features/auth/UserContext'
import AppSwitcher from '@/components/modules/dashboard/AppSwitcher'
import Sidebar from '@/components/modules/dashboard/Sidebar'
import BottomTabBar from '@/components/modules/dashboard/BottomTabBar'
import { accountApps, desktop, isCurrent } from '@/components/modules/dashboard/apps'

export default function DashboardBody({ children }) {
  const path = usePathname()
  const { user } = useUser()
  const apps = accountApps(user)
  const app = apps.find(item => isCurrent(path, item.href))
  const home = path === desktop.href
  return (
    <MotionConfig reducedMotion="user">
      <div className="desk-layout">
        <Sidebar user={user} apps={apps} path={path} />
        <main className="desk-main">
          <nav className="desk-crumb" aria-label="مسیر صفحه">
            <PanelsTopLeft size={16} /><Link href="/p-user" aria-current={home ? 'page' : undefined}>میز کار</Link>
            {!home && <><ChevronLeft size={13}/><span>{app?.label || 'ثبت سفارش'}</span></>}
            <AppSwitcher key={path} apps={apps} />
          </nav>
          <div key={path} className={home ? 'desk-page' : 'desk-page desk-window'}>{children}</div>
        </main>
        <BottomTabBar apps={apps} path={path} />
      </div>
    </MotionConfig>
  )
}
