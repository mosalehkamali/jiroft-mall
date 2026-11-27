import { CreditCard } from "lucide-react";
import AppHeading from "@/components/modules/dashboard/AppHeading";
import CheckoutPaymentPage from '@/components/payments/CheckoutPaymentPage';

const Page = () => {
  return (
    <section className="space-y-5">
      <AppHeading icon={CreditCard} title="پرداخت سفارش" description="جزئیات سفارش و تکمیل پرداخت" />
      <CheckoutPaymentPage />
      <footer className="border-t py-4 text-center text-xs text-slate-500">
        استفاده از این درگاه به منزله پذیرش تمامی قوانین تجارت الکترونیک است.
      </footer>
    </section>
  );
};

export default Page;
