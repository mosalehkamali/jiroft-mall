'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { ChevronLeft, LogOut, UserRound } from 'lucide-react'
import { toast } from 'react-toastify'
import { getUserFullName } from 'base/utils/userName'
import { desktop, isCurrent } from './apps'

export default function Sidebar({ user, apps, path }) {
  const [busy, setBusy] = useState(false)
  async function logout() {
    setBusy(true)
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (!res.ok) throw new Error()
      try { localStorage.removeItem('authUser') } catch {}
      window.location.assign('/')
    } catch {
      toast.error('خروج انجام نشد. دوباره تلاش کنید.')
      setBusy(false)
    }
  }
  return (
    <aside className="desk-sidebar">
      <Link href="/p-user/profile" className="desk-identity">
        <span className="desk-avatar">{user?.avatar ? <Image unoptimized width={42} height={45} src={user.avatar} alt="" /> : <UserRound size={23} />}</span>
        <span><strong>{getUserFullName(user, 'حساب کاربری')}</strong><small dir="auto">{user?.phone || user?.email || 'پروفایل کاربری'}</small></span>
      </Link>
      <nav aria-label="بخش‌های حساب کاربری">
        {[desktop, ...apps].map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} aria-current={isCurrent(path, href) ? 'page' : undefined}>
            <Icon size={18} />{label}<ChevronLeft size={14} className="desk-indicator" />
          </Link>
        ))}
      </nav>
      <button onClick={logout} disabled={busy}><LogOut size={17} />{busy ? 'در حال خروج…' : 'خروج از حساب'}</button>
    </aside>
  )
}
