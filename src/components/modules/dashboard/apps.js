import { CalendarClock, CreditCard, GraduationCap, Heart, MapPin, PanelsTopLeft, ShoppingBag, Ticket, UserRound, Wallet } from 'lucide-react'
import { NEEDS_ADDRESS } from '@/lib/commerce'
import { isHrefEnabled } from '@/lib/features'

export const desktop = { href: '/p-user', label: 'میز کار', icon: PanelsTopLeft }
const apps = [
  ['orders', 'سفارش‌ها', 'پیگیری و جزئیات خرید', ShoppingBag, 'blue'],
  ['payments', 'پرداخت‌ها', 'رسیدها و تاریخچه پرداخت', CreditCard, 'green'],
  ['installments', 'اقساط و چک‌ها', 'سررسید و وضعیت چک‌ها', CalendarClock, 'gold'],
  ['wishlist', 'علاقه‌مندی‌ها', 'کالاهای ذخیره‌شده', Heart, 'rose'],
  ['addresses', 'نشانی‌ها', 'مدیریت نشانی‌های ارسال', MapPin, 'green'],
  ['tickets', 'پشتیبانی', 'ثبت و پیگیری درخواست', Ticket, 'violet'],
  ['profile', 'پروفایل', 'اطلاعات و تنظیمات حساب', UserRound, 'blue'],
  ['wallet', 'کیف پول', 'موجودی و گردش حساب', Wallet, 'gold'],
  ['coach', 'داشبورد مربی', 'اطلاعات و عملکرد مربی', GraduationCap, 'violet'],
].map(([id, label, hint, icon, tone]) => ({ id, href: `/p-user/${id}`, label, hint, icon, tone }))
  .filter(app => isHrefEnabled(app.href) && (app.id !== 'addresses' || NEEDS_ADDRESS))

export function accountApps(user) {
  return apps.filter(app => app.id !== 'coach' || user?.isCoach)
}

export function isCurrent(path, href) {
  return path === href || (href !== desktop.href && path.startsWith(href + '/'))
}

const normalize = value => value.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\s\u200c]/g, '')

export function matchesApp(app, query) {
  return normalize(app.label + (app.hint || '')).includes(normalize(query))
}
