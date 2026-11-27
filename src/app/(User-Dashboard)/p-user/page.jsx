'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { ArrowUpLeft, CalendarDays, ChevronLeft, Search, X } from 'lucide-react'
import storeConfig from 'base/store.config'
import { useUser } from '@/components/features/auth/UserContext'
import { accountApps, matchesApp } from '@/components/modules/dashboard/apps'

const dateFormat = new Intl.DateTimeFormat('fa-IR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Tehran' })

export default function DashboardPage() {
  const { user } = useUser()
  const [query, setQuery] = useState('')
  const apps = accountApps(user).filter(app => matchesApp(app, query))
  return (
    <>
      <section className="desk-hero">
        <div className="desk-hero-copy">
          <p><CalendarDays size={15}/><time suppressHydrationWarning>{dateFormat.format(new Date())}</time></p>
          <h1>{user?.name ? `سلام، ${user.name}` : 'میز کار شما'}</h1>
          <p>به حساب کاربری {storeConfig.brand.name} خوش آمدید.</p>
          <Link href="/p-user/orders">پیگیری سفارش‌ها <ChevronLeft size={16}/></Link>
        </div>
        <div className="desk-art" aria-hidden="true">
          <div className="desk-bag desk-bag-back"><i/><b/></div>
          <div className="desk-bag desk-bag-front"><i/><b/><Image unoptimized width={80} height={72} src={storeConfig.brand.logo} alt="" /></div>
        </div>
      </section>
      <section className="desk-launcher" aria-labelledby="launcher-title">
        <div className="desk-tools">
          <h2 id="launcher-title">برنامه‌های من</h2>
          <label className="desk-search"><Search size={17}/>
            <input aria-label="جستجو در برنامه‌ها" placeholder="جستجو در برنامه‌ها" value={query} onChange={e => setQuery(e.target.value)}/>
          </label>
          {query && <button className="desk-clear" aria-label="پاک کردن جستجو" onClick={() => setQuery('')}><X size={16}/></button>}
        </div>
        {apps.length ? <div className="desk-apps">
          {apps.map(({ href, label, hint, icon: Icon, tone }) => (
            <Link key={href} href={href} className={`desk-app desk-tone-${tone}`}>
              <span className="desk-app-icon"><Icon size={24} strokeWidth={1.7}/></span>
              <ArrowUpLeft size={16} className="desk-arrow"/>
              <strong>{label}</strong><small>{hint}</small>
            </Link>
          ))}
        </div> : <p role="status" className="desk-empty">برنامه‌ای با این عبارت پیدا نشد.</p>}
      </section>
    </>
  )
}
