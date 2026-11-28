'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { MotionConfig } from 'framer-motion'
import { ArrowRight, Check, ChevronDown, Columns2, Layers, LayoutGrid, LogOut, Maximize2, Minimize2, Minus, Monitor, Palette, Store, UserRound, X } from 'lucide-react'
import { toast } from 'react-toastify'
import { useUser } from '@/components/features/auth/UserContext'
import AppSwitcher from '@/components/modules/dashboard/AppSwitcher'
import DesktopHome, { AppIcon } from '@/components/modules/dashboard/DesktopHome'
import RunningApp from '@/components/modules/dashboard/RunningApps'
import { apps, desktop, isCurrent } from '@/components/modules/dashboard/apps'
import storeConfig from 'base/store.config'

const wallpapers = [['tide','شفق'], ['dusk','غروب'], ['forest','جنگل']]
const extra = { id: 'checkout', label: 'ثبت سفارش', icon: Store, tone: 'gold' }
const clock = new Intl.DateTimeFormat('fa-IR', { hour:'2-digit', minute:'2-digit', hour12:false })

export default function DashboardBody({ children, shopMenu }) {
  const { user, loading } = useUser()
  if (loading && !user) return <div id="account-os"><div className="os-wallpaper"/><p className="os-startup" role="status">در حال باز کردن میز کار…</p></div>
  return <DesktopSession key={user?.id || 'guest'} shopMenu={shopMenu}>{children}</DesktopSession>
}

function DesktopSession({ children, shopMenu }) {
  const path = usePathname()
  const router = useRouter()
  const { user } = useUser()
  const home = path === desktop.href
  const active = home ? null : apps.find(app => isCurrent(path, app.href)) || extra
  const [previous, setPrevious] = useState(null)
  const [tasks, setTasks] = useState([])
  const [companion, setCompanion] = useState(null)
  const [maximized, setMaximized] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [now, setNow] = useState(null)
  const [wall, setWall] = useState('tide')
  const [panel, setPanel] = useState('')
  const [leaving, setLeaving] = useState(false)
  const drag = useRef(null)
  const stage = useRef(null)
  const menu = useRef(null)
  const frame = useRef(null)

  if (previous !== path) {
    setPrevious(path)
    if (active) {
      const task = { ...active, path }
      setTasks(list => [...list.filter(item => item.id !== task.id), task])
    }
  }

  useEffect(() => {
    const tick = () => setNow(new Date())
    const initial = requestAnimationFrame(() => {
      tick()
      try {
        const saved = localStorage.getItem('account-wallpaper')
        if (wallpapers.some(([id]) => id === saved)) setWall(saved)
      } catch {}
    })
    const timer = setInterval(tick, 15000)
    return () => { cancelAnimationFrame(initial); clearInterval(timer) }
  }, [])
  useEffect(() => {
    if (!panel) return
    const dismiss = event => {
      if (event.key === 'Escape' || (event.type === 'pointerdown' && !menu.current?.contains(event.target) && !event.target.closest('[data-os-toggle]'))) setPanel('')
    }
    document.addEventListener('keydown', dismiss)
    document.addEventListener('pointerdown', dismiss)
    return () => { document.removeEventListener('keydown', dismiss); document.removeEventListener('pointerdown', dismiss) }
  }, [panel])
  useEffect(() => {
    function reset() { setPosition({ x:0, y:0 }) }
    window.addEventListener('resize', reset)
    return () => window.removeEventListener('resize', reset)
  }, [])

  function toggle(name) { setPanel(p => p === name ? '' : name) }
  function pairWith(app) {
    setTasks(list => [...list.filter(item => item.id !== app.id), { ...app, path: app.href }])
    setCompanion(app.id)
    setPanel('')
  }
  function closeTask(id) {
    if (companion === id || active?.id === id) setCompanion(null)
    setTasks(list => list.filter(item => item.id !== id))
    if (active?.id === id) router.push(desktop.href)
  }
  function move(event) {
    if (!drag.current || !frame.current || !stage.current) return
    const { startX, startY, left, top, minX, maxX, minY, maxY } = drag.current
    setPosition({ x: Math.max(minX, Math.min(maxX, left + event.clientX - startX)), y: Math.max(minY, Math.min(maxY, top + event.clientY - startY)) })
  }
  function startDrag(event) {
    if (event.button !== 0 || maximized || window.innerWidth < 800 || event.target.closest('button')) return
    const box = frame.current.getBoundingClientRect(), area = stage.current.getBoundingClientRect()
    drag.current = { startX:event.clientX, startY:event.clientY, left:position.x, top:position.y,
      minX:position.x + area.left - box.left, maxX:position.x + area.right - box.right,
      minY:position.y + area.top - box.top, maxY:position.y + area.bottom - box.bottom }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  async function logout() {
    setLeaving(true)
    try {
      const res = await fetch('/api/auth/logout', { method:'POST' })
      if (!res.ok) throw new Error()
      try { localStorage.removeItem('authUser') } catch {}
      window.location.assign('/')
    } catch { toast.error('خروج انجام نشد'); setLeaving(false) }
  }
  const dock = [apps.find(app => app.id === 'orders'), apps.find(app => app.id === 'profile'), ...tasks].filter(Boolean)
  const paired = !home && companion !== active?.id && tasks.find(task => task.id === companion)
  const uniqueDock = [...new Map(dock.map(item => [item.id, item])).values()]

  return <MotionConfig reducedMotion="user"><div id="account-os" data-wall={wall}>
    <div className="os-wallpaper" aria-hidden="true"/>
    <header className="os-bar">
      <Link href="/p-user" className="os-brand"><Monitor size={18}/><strong>{storeConfig.brand.name}</strong></Link>
      <span className="os-divider"/><button data-os-toggle onClick={() => toggle('store')} aria-expanded={panel === 'store'}><Store size={16}/> فروشگاه</button>
      <div className="os-bar-end"><button className="os-wallpaper-settings" data-os-toggle aria-label="تنظیمات ظاهر" title="تنظیمات ظاهر" onClick={() => toggle('style')}><Palette size={18}/></button>
      <time dir="ltr">{now ? clock.format(now) : '––:––'}</time><button data-os-toggle aria-label="منوی حساب" onClick={() => toggle('account')}><UserRound size={17}/><ChevronDown size={12}/></button></div>
    </header>
    {panel && <div className={'os-panel panel-'+panel} ref={menu}>
      {panel === 'store' && <><button className="os-store-close" onClick={() => setPanel('')}><X size={17}/> بستن منوی فروشگاه</button>{shopMenu}<Link href="/"><ArrowRight size={16}/> ورود به فروشگاه</Link></>}
      {panel === 'style' && <><h2>تصویر زمینه</h2><div className="os-swatches">{wallpapers.map(([id,label]) => <button key={id} data-wall={id} aria-pressed={id === wall} onClick={() => { setWall(id); try { localStorage.setItem('account-wallpaper', id) } catch {} }}><i/>{label}{id === wall && <Check size={13}/>}</button>)}</div></>}
      {panel === 'account' && <><h2>{user?.name || 'حساب کاربری'}</h2><Link href="/p-user/profile" onClick={() => setPanel('')}><UserRound size={16}/> پروفایل</Link><button disabled={leaving} onClick={logout}><LogOut size={16}/> خروج از حساب</button></>}
      {panel === 'pair' && <><h2>نمایش کنار {active?.label}</h2>{apps.filter(app => app.id !== active?.id).map(app => <button key={app.id} onClick={() => pairWith(app)}><app.icon size={16}/>{app.label}</button>)}</>}
      {panel === 'tasks' && <><h2>برنامه‌های باز</h2>{tasks.length ? tasks.map(task => <div className="os-task-row" key={task.id}><Link href={task.path} onClick={() => setPanel('')}><task.icon size={18}/>{task.label}</Link><button aria-label={'بستن '+task.label} onClick={() => closeTask(task.id)}><X size={15}/></button></div>) : <p>برنامه‌ای باز نیست.</p>}</>}
    </div>}
    <main className="os-stage" ref={stage}>
      <div className="os-desktop" hidden={!home}><DesktopHome now={now}/></div>
      <section ref={frame} hidden={home} className={'os-window'+(maximized || paired ? ' expanded' : '')+(paired ? ' os-paired' : '')} style={{'--win-x':position.x+'px','--win-y':position.y+'px'}} aria-label={active?.label}>
        <header className="os-titlebar" onPointerDown={startDrag} onPointerMove={move} onLostPointerCapture={() => { drag.current = null }} onDoubleClick={e => { if (!e.target.closest('button')) setMaximized(v => !v) }}>
          <span>{active && <active.icon size={17}/>} {active?.label}</span>
          <div><button className="os-pair-button" data-os-toggle title={paired ? 'خروج از نمای دوتایی' : 'نمایش دو برنامه کنار هم'} aria-label={paired ? 'خروج از نمای دوتایی' : 'نمایش دو برنامه کنار هم'} onClick={() => paired ? setCompanion(null) : toggle('pair')}><Columns2 size={17}/></button>
          <button aria-label="کمینه کردن" title="کمینه کردن" onClick={() => router.push(desktop.href)}><Minus size={16}/></button>
          <button className="os-max" aria-label={maximized ? 'بازگرداندن اندازه' : 'بزرگ کردن'} onClick={() => setMaximized(!maximized)}>{maximized ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}</button>
          <button aria-label="بستن پنجره" title="بستن پنجره" onClick={() => closeTask(active.id)}><X size={17}/></button></div>
        </header>
        {tasks.map(task => {
          const visible = task.id === active?.id
          return <div className="os-app-body desk-window" data-companion={Boolean(paired && paired.id === task.id)} hidden={!visible && !(paired && paired.id === task.id)} key={task.id}>
            <RunningApp key={task.path + (task.id === 'orders' && visible && typeof window !== 'undefined' ? window.location.search : '')} task={task}>{visible && children}</RunningApp>
          </div>
        })}
      </section>
    </main>
    <footer className="os-dock-area"><nav className="os-dock" aria-label="نوار برنامه‌ها">
      <Link href="/p-user" aria-label="میز کار" title="میز کار" aria-current={home ? 'page' : undefined}><span className="os-icon tint-home"><LayoutGrid/></span></Link>
      <AppSwitcher key={path} apps={apps}/>
      <i className="os-dock-line"/>
      <div className="os-dock-apps">{uniqueDock.map(app => <Link key={app.id} href={app.path || app.href} data-open={tasks.some(t => t.id === app.id)} aria-label={app.label} title={app.label} aria-current={active?.id === app.id ? 'page' : undefined}><AppIcon app={app}/></Link>)}</div>
      <button className="os-tasks" data-os-toggle aria-label="برنامه‌های باز" title="برنامه‌های باز" onClick={() => toggle('tasks')}><Layers size={20}/></button>
    </nav></footer>
  </div></MotionConfig>
}
