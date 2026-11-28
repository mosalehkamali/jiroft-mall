'use client'

import PaymentWindow from '@/components/payments/PaymentWindow'
import dynamic from 'next/dynamic'

const NewTicket = dynamic(() => import('@/components/modules/tickets/NewTicketForm'))
const TicketChat = dynamic(() => import('@/components/modules/tickets/TicketChat'))

const OrderCheckout = dynamic(() => import('@/components/order/AccountCheckout'))
const Payment = dynamic(() => import('@/components/payments/PaymentPage'))
const CheckoutPayment = dynamic(() => import('@/components/payments/CheckoutPaymentPage'))
const Success = dynamic(() => import('@/components/payments/PaymentSuccessPage'))

const runningApps = {
  profile: dynamic(() => import('@/components/modules/profile')),
  orders: dynamic(() => import('@/components/modules/orders')),
  payments: dynamic(() => import('@/components/modules/payments')),
  wishlist: dynamic(() => import('@/components/modules/wishlist')),
  addresses: dynamic(() => import('@/components/modules/addresses')),
  installments: dynamic(() => import('@/components/modules/installments')),
  tickets: dynamic(() => import('@/components/modules/tickets')),
  wallet: dynamic(() => import('@/components/modules/wallet')),
}

export default function RunningApp({ task, children }) {
  const Component = runningApps[task.id]
  if (task.path === task.href && Component) return <Component/>
  if (task.path === '/p-user/signOrder') return <OrderCheckout/>
  if (task.path === '/p-user/tickets/new') return <NewTicket/>
  const leaf = task.path.split('/').pop()
  if (task.id === 'tickets') return <TicketChat ticketId={leaf}/>
  if (task.path.startsWith('/p-user/orders/success/')) return <Success trackingCode={leaf}/>
  if (task.id === 'payments') return <PaymentWindow>{leaf === 'checkout' ? <CheckoutPayment/> : <Payment trackingCode={leaf}/>}</PaymentWindow>
  return children
}
