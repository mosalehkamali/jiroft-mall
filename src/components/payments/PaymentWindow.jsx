import { CreditCard } from "lucide-react";
import AppHeading from "@/components/modules/dashboard/AppHeading";

export default function PaymentWindow({ children }) {
  return (
    <section className="space-y-5">
      <AppHeading icon={CreditCard} title="پرداخت سفارش" description="جزئیات سفارش و تکمیل پرداخت" />
      {children}
      <footer className="border-t py-4 text-center text-xs text-slate-500">
        استفاده از این درگاه به منزله پذیرش تمامی قوانین تجارت الکترونیک است.
      </footer>
    </section>
  );
}
