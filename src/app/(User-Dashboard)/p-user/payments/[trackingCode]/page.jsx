import PaymentWindow from '@/components/payments/PaymentWindow'
import PaymentPage from '@/components/payments/PaymentPage'

export default async function Page({ params }) {
  const { trackingCode } = await params
  return <PaymentWindow><PaymentPage trackingCode={trackingCode}/></PaymentWindow>
}
