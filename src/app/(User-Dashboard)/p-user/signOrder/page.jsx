"use client";

/**
 * src/app/(User-Dashboard)/p-user/signOrder/page.jsx
 *
 * صفحه ثبت سفارش — اصلاح فیلدهای ارسالی سبد خرید برای پشتیبانی از محصولات دست دوم
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FiShoppingCart, FiArrowRight } from "react-icons/fi";
import Link from "next/link";

import CartItems from "@/components/order/CartItems";
import CartSummary from "@/components/order/CartSummary";
import WalletCheckoutPanel from "@/components/order/WalletCheckoutPanel";
import AddressSelector from "@/components/order/AddressSelector";
import AddressModal from "@/components/order/AddressModal";
import PaymentMethods from "@/components/order/PaymentMethods";
import OrderActions from "@/components/order/OrderActions";

import { useCart } from "@/hooks/useCart";
import { isFeatureEnabled } from "@/lib/features";
import { NEEDS_ADDRESS, checkoutPaymentMethods } from "@/lib/commerce";

// store.config.js: روش‌های پرداخت، نیاز به آدرس، کیف پول و کد تخفیف
const PAYMENT_METHODS = checkoutPaymentMethods();
const WALLET_ON = isFeatureEnabled("wallet");
const COUPONS_ON = isFeatureEnabled("discounts");
import { useAddresses } from "@/hooks/useAddresses";

const OrderPage = () => {
  const router = useRouter();

  // کد تخفیف همین‌جا اعمال می‌شود و در storage تا پایان پرداخت فعال می‌ماند
  const {
    cartItems,
    isLoading: isCartLoading,
    updateQuantity,
    removeItem,
    removeFlowSelection,
    applyCoupon,
    removeCoupon,
    appliedCoupon,
    couponDiscount,
    couponError,
    totalItems,
    totalPrice,
    totalRawPrice,
    totalDiscount,
  } = useCart();

  const { addresses, isLoading: isAddressLoading, addAddress } = useAddresses();

  const [selectedAddress, setSelectedAddress] = useState(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(PAYMENT_METHODS.length === 1 ? PAYMENT_METHODS[0] : null);
  const [walletEnabled, setWalletEnabled] = useState(false);
  const [walletInput, setWalletInput] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const walletInvalid = walletEnabled && (!Number.isSafeInteger(Number(walletInput)) || Number(walletInput) > Math.min(walletBalance, totalPrice));
  const walletAmount = walletEnabled && !walletInvalid ? Number(walletInput) || 0 : 0;
  const payable = Math.max(0, totalPrice - walletAmount);

  // سفارش در این مرحله ساخته نمی‌شود؛ کاربر به صفحه پرداخت می‌رود و
  // سفارش فقط پس از ثبت موفق پرداخت/اقساط ایجاد خواهد شد.
  // ناوبری کلاینتی است تا بازگشت با دکمه مرورگر، صفحه را از bfcache با
  // state کهنه (دکمه در حال بارگذاری) برنگرداند.
  const handleProceedToPayment = () => {
    router.push('/p-user/payments/checkout');
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <ToastContainer
        position="top-center"
        autoClose={3000}
        rtl
        theme="light"
        toastClassName="font-vazir"
      />

      {NEEDS_ADDRESS && <AddressModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        addresses={addresses}
        selectedAddress={selectedAddress}
        onSelectAddress={setSelectedAddress}
        onAddAddress={addAddress}
        isLoading={isAddressLoading}
      />}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/p-user"
                className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                aria-label="بازگشت"
              >
                <FiArrowRight className="w-5 h-5 text-[var(--color-text)]" />
              </Link>

              <h1 className="absolute flex items-center px-13 gap-2 text-lg md:text-xl font-bold text-[var(--color-text)]">
                <FiShoppingCart className="w-5 h-5 md:w-6 md:h-6 text-[var(--color-primary)]" />
                ثبت سفارش
              </h1>

              {totalItems > 0 && (
                <div className="relative bottom-3 left-4 px-3 py-1 rounded-full text-sm font-medium bg-[var(--color-secondary)]/20 text-[var(--color-primary)]">
                  {totalItems}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container py-6 md:py-10 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

          {/* ─── ستون چپ ─── */}
          <div className="lg:col-span-2 space-y-8">
            <section className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-[6px] p-4 md:p-6">
                <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--color-text)] mb-4">
                  <FiShoppingCart className="w-5 h-5 text-[var(--color-primary)]" />
                  سبد خرید شما
                </h2>
                <CartItems
                  items={cartItems}
                  onUpdateQuantity={updateQuantity}
                  onRemoveItem={removeItem}
                  onRemoveFlowSelection={removeFlowSelection}
                  isLoading={isCartLoading}
                />
              </div>
            </section>

            {NEEDS_ADDRESS && (
              <AddressSelector
                selectedAddress={selectedAddress}
                onOpenModal={() => setIsAddressModalOpen(true)}
              />
            )}

            <PaymentMethods
              methods={PAYMENT_METHODS}
              selectedMethod={selectedPaymentMethod}
              onSelectMethod={setSelectedPaymentMethod}
            />
          </div>

          {/* ─── ستون راست / خلاصه ─── */}
          <div className="space-y-6">
            <div className="lg:sticky lg:top-28 space-y-6">

              <div className="bg-white border border-gray-200 rounded-[6px] p-4 md:p-6">
                <CartSummary
                  totalItems={totalItems}
                  totalPrice={payable}
                  walletAmount={walletAmount}
                  walletSection={WALLET_ON ? <WalletCheckoutPanel enabled={walletEnabled} onToggle={setWalletEnabled} amount={walletInput} onAmountChange={setWalletInput} total={totalPrice} balance={walletBalance} onBalanceChange={setWalletBalance} /> : null}
                  showCoupon={COUPONS_ON}
                  totalRawPrice={totalRawPrice}
                  totalDiscount={totalDiscount}
                  couponDiscount={couponDiscount}
                  appliedCoupon={appliedCoupon}
                  couponError={couponError}
                  onApplyCoupon={applyCoupon}
                  onRemoveCoupon={removeCoupon}
                  isLoading={isCartLoading}
                />
              </div>

              {/* 🛡️ اصلاح شد: انتقال کامل و امن کلیدهای محصولات نو و دست دوم */}
              <OrderActions
                cartItems={cartItems.map((i) => ({
                  // 🛡️ اگر محصول اصلی وجود داشت آن را بگذارد، در غیر این صورت آیدی دست دوم را به عنوان پشتیبان قرار دهد
                  productId: i.productId || i.usedProductId || null,
                  variantId: i.variantId ?? null,
                  usedProductId: i.usedProductId || null,
                  itemType: i.itemType || 'product',
                  quantity: i.quantity,
                  flowSelections: i.flowSelections ?? [],
                }))}
                finalTotalToman={payable}
                walletAmount={walletAmount}
                walletInvalid={walletInvalid || isCartLoading}
                selectedAddress={selectedAddress}
                selectedPaymentMethod={payable === 0 && (walletAmount > 0 || appliedCoupon?.createdByCoach) ? 'BANK_RECEIPT' : selectedPaymentMethod}
                onProceed={handleProceedToPayment}
              />

            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="container py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-sm text-gray-500">
            <div className="flex items-center px-5 gap-4">
              <Link href="/terms" className="hover:text-[var(--color-primary)] transition-colors">قوانین و مقررات</Link>
              <Link href={isFeatureEnabled("tickets") ? "/p-user/tickets" : "/contact"} className="hover:text-[var(--color-primary)] transition-colors">پشتیبانی</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default OrderPage;
