'use client'

import { useState } from 'react'
import { Pencil, UserRound, Check, X } from 'lucide-react'
import { toast } from 'react-toastify'
import { useUser } from '@/components/features/auth/UserContext'
import { getUserFullName } from 'base/utils/userName'

const fields = [
  ['name', 'نام', 'given-name', 'text'], ['lastName', 'نام خانوادگی', 'family-name', 'text'],
  ['email', 'ایمیل', 'email', 'email'], ['phone', 'تلفن همراه', 'tel', 'tel'],
]

export default function ProfileModule() {
  const { user, loading, refresh } = useUser()
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  async function save(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/auth/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'ذخیره نشد')
      await refresh()
      setDraft(null)
      toast.success('اطلاعات حساب ذخیره شد')
    } catch (error) { toast.error(error.message) } finally { setSaving(false) }
  }
  if (!user) return <p role="status">{loading ? 'در حال دریافت اطلاعات…' : 'اطلاعات حساب در دسترس نیست.'}</p>
  return <section className="os-profile">
    <header><span className="os-profile-avatar">{user.avatar ? <img src={user.avatar} alt="" /> : <UserRound/>}</span>
      <div><h1>{getUserFullName(user, 'حساب کاربری')}</h1>{user.createdAt && <p>عضو از {new Date(user.createdAt).toLocaleDateString('fa-IR')}</p>}</div>
    </header>
    <form onSubmit={save}>
      <div className="os-profile-tools"><h2>مشخصات فردی</h2>{!draft && <button type="button" onClick={() => setDraft(Object.fromEntries(fields.map(([key]) => [key, user[key] || ''])))}><Pencil size={15}/> ویرایش مشخصات</button>}</div>
      <div className="os-fields">{fields.map(([key, label, autocomplete, type]) => <div key={key}>
        {draft ? <label>{label}<input type={type} autoComplete={autocomplete} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })}/></label> : <><small>{label}</small><strong dir="auto">{user[key] || 'ثبت نشده'}</strong></>}
      </div>)}</div>
      {draft && <footer><button disabled={saving}><Check size={16}/> ذخیره تغییرات</button><button disabled={saving} type="button" onClick={() => setDraft(null)}><X size={16}/> انصراف</button></footer>}
    </form>
  </section>
}
