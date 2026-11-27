'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Grid2X2, Search, X } from 'lucide-react'
import { desktop, matchesApp } from './apps'

export default function AppSwitcher({ apps }) {
  const dialog = useRef(null)
  const [query, setQuery] = useState('')
  const results = [desktop, ...apps].filter(app => matchesApp(app, query))

  useEffect(() => {
    function shortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (dialog.current.open) dialog.current.close()
        else dialog.current.showModal()
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])

  return <>
    <button className="desk-switch-trigger" aria-haspopup="dialog" onClick={() => dialog.current.showModal()}>
      <Grid2X2 size={15}/> برنامه‌ها <kbd dir="ltr">Ctrl K</kbd>
    </button>
    <dialog ref={dialog} aria-label="رفتن به برنامه" className="desk-switcher" onClose={() => setQuery('')}
      onClick={event => { if (event.target === dialog.current) dialog.current.close() }}>
      <div>
        <div className="desk-switch-search">
          <Search size={18}/><input autoFocus aria-label="نام برنامه" placeholder="رفتن به برنامه…" value={query} onChange={event => setQuery(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) dialog.current.querySelector('a')?.click() }}/>
          <button aria-label="بستن" onClick={() => dialog.current.close()}><X size={18}/></button>
        </div>
        <nav aria-label="نتایج جستجوی برنامه">
          {results.map(({ href, label, icon: Icon }) => <Link href={href} key={href} onClick={() => dialog.current.close()}><Icon size={18}/>{label}</Link>)}
          {!results.length && <p role="status">برنامه‌ای پیدا نشد.</p>}
        </nav>
      </div>
    </dialog>
  </>
}
