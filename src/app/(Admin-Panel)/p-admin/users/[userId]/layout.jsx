import { notFound } from 'next/navigation'

export default async function UserDetailLayout({ params, children }) {
  const { userId } = await params
  if (!/^[0-9a-f]{24}$/i.test(userId)) notFound()
  return children
}
