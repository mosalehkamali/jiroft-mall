import Link from 'next/link'
import { desktop, isCurrent } from './apps'

export default function BottomTabBar({ apps, path }) {
  const tabs = [desktop, ...['orders', 'tickets', 'profile'].map(id => apps.find(app => app.id === id)).filter(Boolean)]
  return (
    <nav className="desk-dock" aria-label="دسترسی سریع">
      {tabs.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={isCurrent(path, href) ? 'page' : undefined}>
          <Icon size={20} /><span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}
