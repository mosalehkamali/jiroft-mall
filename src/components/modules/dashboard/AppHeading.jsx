export default function AppHeading({ icon: Icon, title, description, count }) {
  return (
    <header className="desk-app-heading">
      <span aria-hidden="true"><Icon size={23} /></span>
      <div>
        <h1>{title}{count > 0 && <small>{count.toLocaleString('fa-IR')}</small>}</h1>
        <p>{description}</p>
      </div>
    </header>
  )
}
