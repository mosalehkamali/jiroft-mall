'use client'

import Link from 'next/link'
import { ArrowUpLeft, CalendarDays, PackageOpen } from 'lucide-react'
import useSWR from 'swr'
import { useUser } from '@/components/features/auth/UserContext'
import { apps } from './apps'

const clock = new Intl.DateTimeFormat('fa-IR', {hour:'2-digit', minute:'2-digit', hour12:false})
const date = new Intl.DateTimeFormat('fa-IR', {weekday:'long', day:'numeric', month:'long'})
async function ordersFetcher([url]) {
  const res = await fetch(url)
  if (!res.ok) throw new Error()
  return res.json()
}
export function AppIcon({ app }) {
  return <span aria-hidden="true" className={`os-icon tint-${app.tone}`}><app.icon strokeWidth={1.65}/></span>
}
export default function DesktopHome({ now }) {
  const { user } = useUser()
  const { data, error, mutate } = useSWR(user?.id ? ['/api/orders?view=latest', user.id] : null, ordersFetcher)
  const last = data?.order
  const minutes = now?.getMinutes() ?? 0
  const hours = now?.getHours() ?? 0
  return <div className="os-home">
    <div className="os-home-title"><h1>میز کار من</h1><p>{user?.name ? `${user.name}، خوش آمدید` : 'فضای شخصی شما'}</p></div>
    <section className="os-widgets" aria-label="ابزارک‌ها">
      <article className="os-time"><div><span><CalendarDays size={15}/> تقویم</span><strong dir="ltr">{now ? clock.format(now) : '––:––'}</strong><small>{now ? date.format(now) : 'امروز'}</small></div>
        <div className="os-clock" aria-hidden="true"><i style={{rotate:`${hours * 30 + minutes / 2}deg`}}/><b style={{rotate:`${minutes * 6}deg`}}/></div>
      </article>
      <article className="os-order-widget"><div><PackageOpen size={17}/><span>آخرین سفارش</span></div>
        <strong>{last ? last.trackingCode : error ? 'دریافت سفارش‌ها ممکن نشد' : data ? 'هنوز سفارشی ثبت نشده' : 'در حال دریافت…'}</strong>
        {error ? <button onClick={() => mutate()}>تلاش دوباره</button> : <Link href={last ? '/p-user/orders?order='+encodeURIComponent(last.trackingCode) : '/p-user/orders'}>مشاهده {last ? 'جزئیات' : 'سفارش‌ها'} <ArrowUpLeft size={15}/></Link>}
      </article>
    </section>
    <section aria-label="برنامه‌های حساب" className="os-launchpad">
      {apps.map(app => <Link key={app.id} href={app.href} title={app.hint}><AppIcon app={app}/><span>{app.label}</span></Link>)}
    </section>
  </div>
}
