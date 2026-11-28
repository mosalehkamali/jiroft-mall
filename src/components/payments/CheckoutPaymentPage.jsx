"use client";

/**
 * src/components/payments/CheckoutPaymentPage.jsx
 *
 * صفحه پرداختِ پیش از ثبت سفارش.
 *
 * در این مرحله هنوز هیچ سفارشی ساخته نشده است؛ اطلاعات از سبد خرید زنده
 * (localStorage) و اطلاعات مرحله ثبت سفارش (sessionStorage) خوانده می‌شود.
 * کاربر می‌تواند برگردد، سبد را تغییر دهد و دوباره ادامه دهد.
 *
 * سفارش فقط پس از ثبت موفق پرداخت (رسید بانکی) یا تکمیل درخواست اقساط در
 * POST /api/checkout ساخته می‌شود؛ همان‌جا پرداخت به سفارش متصل و سبد خالی می‌گردد.
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { FiArrowRight } from 'react-icons/fi';
import Link from 'next/link';

import OrderSummary from '@/components/payments/OrderSummary';
import BankInfoBox from '@/components/payments/BankInfoBox';
import ReceiptUploader from '@/components/payments/ReceiptUploader';
import EmailBox from '@/components/payments/EmailBox';
import RulesAgreement from '@/components/payments/RulesAgreement';
import SubmitPaymentButton from '@/components/payments/SubmitPaymentButton';
import InstallmentPage from '@/components/payments/InstallmentPage';

import { useCart } from '@/hooks/useCart';
import { getCart, clearCart } from '@/lib/cart';
import { getPendingCheckout, clearPendingCheckout } from '@/lib/pendingCheckout';
import { getProfile, editProfile } from '@/hooks/useProfile';

// آیتم‌های خام سبد (localStorage) — همان شکلی که سرور برای محاسبه قیمت می‌پذیرد
const prepareItemsForServer = () =>
  getCart().map((item) => {
    if (item.itemType === 'used_product') {
      return {
        usedProductId: item.usedProductId,
        itemType: 'used_product',
        quantity: 1,
      };
    }
    return {
      productId: item.productId,
      variantId: item.variantId ?? null,
      itemType: 'product',
      quantity: item.quantity,
      flowSelections: item.flowSelections ?? [],
    };
  });

const CheckoutPaymentPage = () => {
  const router = useRouter();

  // کد تخفیف در صفحه ثبت سفارش اعمال شده و از storage به‌صورت خودکار
  // بازخوانی/اعتبارسنجی می‌شود؛ totalPrice همیشه مبلغ پس از کوپن است
  const {
    cartItems,
    isLoading: isCartLoading,
    appliedCoupon,
    couponDiscount,
    totalPrice,
    totalRawPrice,
    totalDiscount,
  } = useCart();

  const [checkout,      setCheckout]      = useState(null);
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [user,          setUser]          = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [receiptUrls,  setReceiptUrls]  = useState([]);
  const [email,        setEmail]        = useState('');
  const [rulesChecked, setRulesChecked] = useState(false);
  const [nationalCode, setNationalCode] = useState('');
  const [rozOrderId,   setRozOrderId]   = useState(null);
  const [otp,          setOtp]          = useState('');
  const walletAmount = Number(checkout?.walletAmount || 0);
  const payable = Math.max(0, totalPrice - walletAmount);
  const fullyWalletPaid = walletAmount > 0 && payable === 0;

  // ─── بارگذاری اطلاعات مرحله ثبت سفارش ───
  useEffect(() => {
    const pending = getPendingCheckout();

    if (!pending) {
      toast.error('لطفاً ابتدا مراحل ثبت سفارش را تکمیل کنید');
      router.replace('/p-user/signOrder');
      return;
    }

    setCheckout(pending);
    setCheckoutReady(true);

    // بازگشت از درگاه بدونِ پرداختِ موفق — سبد دست‌نخورده است و می‌شود دوباره پرداخت کرد
    const gatewayResult = new URLSearchParams(window.location.search).get('payment');
    if (gatewayResult) {
      toast.error(
        gatewayResult === 'expired'
          ? 'مهلت پرداخت این سفارش تمام شده بود؛ مبلغی کسر نشده یا ظرف چند ساعت به حسابتان برمی‌گردد. دوباره پرداخت کنید.'
          : 'پرداخت انجام نشد. اگر مبلغی از حسابتان کسر شده، ظرف چند ساعت برمی‌گردد. می‌توانید دوباره پرداخت کنید.',
        { autoClose: false },
      );
      window.history.replaceState(null, '', window.location.pathname);
    }

    // موجودیِ لحظه‌ایِ اقلام، پیش از هر پرداختی (کارت‌به‌کارت یا درگاه)
    fetch('/api/checkout/stock-check', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: prepareItemsForServer() }),
    })
      .then(async (res) => {
        if (res.status !== 409) return;
        const data = await res.json();
        await Swal.fire({
          title: 'موجودی کافی نیست',
          text: `${data.message}. لطفاً سبد خرید را اصلاح کنید؛ هنوز مبلغی پرداخت نکرده‌اید.`,
          icon: 'warning',
          confirmButtonText: 'بازگشت به سبد خرید',
          confirmButtonColor: 'var(--color-primary)',
          allowOutsideClick: false,
        });
        router.replace('/p-user/signOrder');
      })
      .catch(() => {}); // خطای شبکه مانعِ خرید نیست؛ سرور هنگامِ ثبت دوباره بررسی می‌کند

    getProfile()
      .then((profile) => setUser(profile))
      .catch(() => setUser(null));
  }, []); // eslint-disable-line

  const validateEmail = (val) => {
    if (!val) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  // ─── ارسال نهایی به سرور — اینجا سفارش ساخته می‌شود ───
  const submitCheckout = async (paymentFields) => {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items:           prepareItemsForServer(),
        addressId:       checkout.addressId,
        addressSnapshot: checkout.addressSnapshot,
        paymentMethod:   checkout.paymentMethod,
        // کد تخفیفِ اعمال‌شده در صفحه ثبت سفارش — سرور دوباره اعتبارسنجی می‌کند
        couponCode:      appliedCoupon?.code ?? null,
        description:     checkout.description,
        walletAmount,
        checkoutKey: checkout.checkoutKey,
        expectedTotal: totalPrice,
        ...paymentFields,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'خطا در ثبت سفارش و پرداخت');
    }
    if (!data?.trackingCode) {
      throw new Error('کد پیگیری سفارش از سرور دریافت نشد');
    }

    return data;
  };

  const handleCheckoutSuccess = async (trackingCode, successText) => {
    // سفارش ساخته شد — سبد و اطلاعات موقت پاک می‌شوند
    clearCart();
    clearPendingCheckout();

    await Swal.fire({
      title:              'پرداخت با موفقیت ثبت شد',
      text:               successText,
      icon:               'success',
      confirmButtonText:  'متوجه شدم',
      confirmButtonColor: 'var(--color-primary)',
    });

    window.location.replace(`/p-user/orders/success/${trackingCode}`);
  };

  // ─── ثبت رسید بانکی ───
  const handleBankReceiptSubmit = async () => {
    if (receiptUrls.length === 0 && !fullyWalletPaid) {
      toast.error('لطفاً حداقل یک تصویر فیش واریزی بارگذاری کنید.');
      return;
    }
    if (!rulesChecked) {
      toast.error('پذیرش قوانین الزامی است.');
      return;
    }
    if (email && !validateEmail(email)) {
      toast.error('فرمت ایمیل وارد شده صحیح نیست.');
      return;
    }

    setSubmitLoading(true);

    try {
      if (email) {
        await editProfile({ email });
      }

      const data = await submitCheckout({ receiptImageUrls: receiptUrls });

      await handleCheckoutSuccess(
        data.trackingCode,
        fullyWalletPaid ? 'سفارش شما بدون مانده پرداخت ثبت شد.' : 'سفارش شما ثبت شد؛ اطلاعات پرداخت در حال بررسی است و نتیجه تا ساعاتی دیگر اعلام خواهد شد.',
      );
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'خطایی در ثبت اطلاعات رخ داد. مجدداً تلاش کنید.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // ─── پرداخت آنلاین: سفارش ساخته می‌شود و مشتری به درگاه می‌رود ───
  // سبد عمداً پاک نمی‌شود: اگر پرداخت ناموفق بود، کاربر با همان سبد برمی‌گردد.
  const handleOnlineSubmit = async () => {
    if (!rulesChecked) {
      toast.error('پذیرش قوانین الزامی است.');
      return;
    }
    if (email && !validateEmail(email)) {
      toast.error('فرمت ایمیل وارد شده صحیح نیست.');
      return;
    }
    setSubmitLoading(true);
    try {
      if (email) await editProfile({ email });
      const data = await submitCheckout({});
      if (!data.paymentUrl) throw new Error('آدرس درگاه پرداخت دریافت نشد');
      window.location.assign(data.paymentUrl);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'خطا در اتصال به درگاه پرداخت');
      setSubmitLoading(false);
    }
  };

  // ─── رزپرداخت: ۱) کد ملی → سفارش ساخته می‌شود و کد پیامک می‌شود  ۲) کد → پرداخت ───
  // سبد تا پرداختِ موفق پاک نمی‌شود (صفحه‌ی موفقیت با ?paid پاکش می‌کند).
  const handleRozStart = async () => {
    if (!rulesChecked) return toast.error('پذیرش قوانین الزامی است.');
    if (!/^[0-9۰-۹]{10}$/.test(nationalCode.trim())) return toast.error('کد ملی ۱۰ رقمی را وارد کنید.');
    if (email && !validateEmail(email)) return toast.error('فرمت ایمیل وارد شده صحیح نیست.');
    setSubmitLoading(true);
    try {
      if (email) await editProfile({ email });
      const data = await submitCheckout({ nationalCode: nationalCode.trim() });
      setRozOrderId(data.orderId);
      toast.success(data.message);
    } catch (error) {
      toast.error(error.message || 'خطا در اتصال به رزپرداخت');
    } finally {
      setSubmitLoading(false);
    }
  };

  const rozCall = async (body) => {
    const res = await fetch('/api/payments/rozpardakht', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: rozOrderId, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || 'خطا در ارتباط با رزپرداخت');
      err.status = res.status;
      throw err;
    }
    return data;
  };

  const handleRozConfirm = async () => {
    if (!otp.trim()) return toast.error('کد پیامک‌شده را وارد کنید.');
    setSubmitLoading(true);
    try {
      const data = await rozCall({ action: 'confirm', code: otp.trim() });
      window.location.replace(`/p-user/orders/success/${encodeURIComponent(data.trackingCode)}?paid=rozpardakht`);
    } catch (error) {
      toast.error(error.message, { autoClose: error.status === 409 || error.status === 502 ? false : 5000 });
      if (error.status === 409) setRozOrderId(null); // سفارش لغو شد؛ از اول یا با روش دیگر
      setSubmitLoading(false);
    }
  };

  const handleRozResend = async () => {
    setSubmitLoading(true);
    try {
      toast.success((await rozCall({ action: 'resend' })).message);
    } catch (error) {
      toast.error(error.message);
      if (error.status === 409) setRozOrderId(null);
    } finally {
      setSubmitLoading(false);
    }
  };

  // ─── ثبت درخواست اقساط (از InstallmentPage فراخوانی می‌شود) ───
  const handleInstallmentSubmit = async (installmentPayload) => {
    const data = await submitCheckout({ installment: installmentPayload });

    await handleCheckoutSuccess(
      data.trackingCode,
      'سفارش و طرح اقساطی شما ثبت شد و پس از بررسی پیش‌پرداخت، نتیجه اعلام خواهد شد.',
    );
  };

  // ─── Loading ───
  if (!checkoutReady || isCartLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin" />
        <p className="text-gray-500 font-medium">در حال دریافت اطلاعات پرداخت...</p>
      </div>
    );
  }

  // ─── سبد خالی ───
  if (cartItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <p className="text-gray-600 font-bold">سبد خرید شما خالی است</p>
        <p className="text-gray-400 text-sm">
          برای ادامه فرایند پرداخت ابتدا محصولی به سبد اضافه کنید.
        </p>
        <Link
          href="/p-user/signOrder"
          className="px-5 py-2.5 rounded-[6px] bg-[var(--color-primary)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
        >
          بازگشت به ثبت سفارش
        </Link>
      </div>
    );
  }

  if (walletAmount > totalPrice) {
    return <div className="space-y-4 p-6 text-center"><p>مبلغ سبد تغییر کرده است؛ مبلغ کیف پول را دوباره انتخاب کنید.</p><Link href="/p-user/signOrder" className="text-[var(--color-primary)]">بازگشت به ثبت سفارش</Link></div>;
  }

  // ─── سفارش مجازی (هنوز در دیتابیس ساخته نشده) برای کامپوننت‌های نمایش ───
  const pseudoOrder = {
    trackingCode:  null, // پس از تکمیل پرداخت صادر می‌شود
    paymentMethod: fullyWalletPaid ? 'WALLET' : checkout.paymentMethod,
    walletPaid: walletAmount,
    payments: walletAmount > 0 ? [{ method: 'WALLET', status: 'PAID', amount: walletAmount }] : [],
    items: cartItems.map((item) => ({
      itemType: item.itemType,
      quantity: item.quantity,
      unitPrice: item.unitPriceToman,
      product: {
        _id:       item.productId,
        name:      item.product?.product?.name,
        mainImage: item.product?.product?.mainImage,
      },
      usedProduct:
        item.itemType === 'used_product'
          ? {
              _id:    item.usedProductId,
              name:   item.product?.product?.name,
              images: item.product?.product?.mainImage
                ? [item.product.product.mainImage]
                : [],
            }
          : null,
      variant: item.variant ?? null,
    })),
    subtotalPrice:  totalRawPrice,
    discountAmount: totalDiscount,
    couponDiscount,
    coupon:         appliedCoupon,
    totalPrice,
  };

  // ─── لینک بازگشت برای ویرایش سبد/سفارش ───
  const backLink = (
    <Link
      href="/p-user/signOrder"
      className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-primary)] hover:gap-2.5 transition-all mb-4"
    >
      <FiArrowRight className="w-4 h-4" />
      بازگشت و ویرایش سبد خرید
    </Link>
  );

  // ─── اقساط ───
  if (checkout.paymentMethod === 'INSTALLMENT' && !fullyWalletPaid) {
    return (
      <div>
        {backLink}
        <InstallmentPage
          user={user}
          order={pseudoOrder}
          onFinalSubmit={handleInstallmentSubmit}
        />
      </div>
    );
  }

  // ─── رسید بانکی / پرداخت آنلاین ───
  const isOnline = checkout.paymentMethod === 'ONLINE' && !fullyWalletPaid;
  const isRoz = checkout.paymentMethod === 'ROZPARDAKHT' && !fullyWalletPaid;
  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-lg tracking-widest outline-none focus:border-[var(--color-primary)]';

  if (isRoz) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {!rozOrderId && backLink}
        <div className="flex flex-col md:flex-row md:flex-row-reverse">
          <div className="md:w-1/3 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
            <OrderSummary order={pseudoOrder} />
          </div>
          <div className="md:w-2/3 flex flex-col gap-4 sm:gap-6 md:px-6">
            {!rozOrderId ? (
              <>
                <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <p className="text-sm leading-7 text-slate-700">
                    کد ملی‌ای را وارد کنید که با آن در رزپرداخت ثبت‌نام کرده‌اید. اگر اعتبار کافی داشته باشید، کد تأیید به موبایل شما پیامک می‌شود.
                  </p>
                  <label className="block text-sm font-bold text-slate-700" htmlFor="roz-national-code">کد ملی</label>
                  <input
                    id="roz-national-code"
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={10}
                    value={nationalCode}
                    onChange={(e) => setNationalCode(e.target.value.replace(/[^0-9۰-۹]/g, ''))}
                    className={inputCls}
                  />
                </section>
                <EmailBox show={!user?.email} email={email} setEmail={setEmail} />
                <RulesAgreement checked={rulesChecked} onChange={setRulesChecked} />
                <SubmitPaymentButton
                  loading={submitLoading}
                  disabled={!rulesChecked || nationalCode.length !== 10}
                  onClick={handleRozStart}
                  label="دریافت کد تأیید"
                  loadingLabel="در حال بررسی اعتبار..."
                />
              </>
            ) : (
              <>
                <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <p className="text-sm leading-7 text-slate-700">
                    کد تأییدی را که رزپرداخت به موبایل شما پیامک کرد وارد کنید. با تأیید، مبلغ سفارش از اعتبار رزپرداخت شما کسر می‌شود.
                  </p>
                  <label className="block text-sm font-bold text-slate-700" htmlFor="roz-otp">کد تأیید</label>
                  <input
                    id="roz-otp"
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={10}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9۰-۹]/g, ''))}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    disabled={submitLoading}
                    onClick={handleRozResend}
                    className="text-sm font-bold text-[var(--color-primary)] disabled:opacity-50"
                  >
                    کد را دریافت نکردم، دوباره بفرست
                  </button>
                </section>
                <SubmitPaymentButton
                  loading={submitLoading}
                  disabled={!otp}
                  onClick={handleRozConfirm}
                  label="تأیید و پرداخت"
                  loadingLabel="در حال تأیید پرداخت..."
                />
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {backLink}

      <div className="flex flex-col md:flex-row md:flex-row-reverse">
        <div className="md:w-1/3 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
          <OrderSummary order={pseudoOrder} />
        </div>

        <div className="md:w-2/3 flex flex-col gap-4 sm:gap-6 md:px-6">
          {!fullyWalletPaid && !isOnline && <BankInfoBox />}

          {!fullyWalletPaid && !isOnline && <ReceiptUploader onFileChange={setReceiptUrls} />}
          {isOnline && (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
              با زدن دکمه‌ی زیر به درگاه امن زرین‌پال منتقل می‌شوید. سفارش شما پس از پرداخت موفق ثبت نهایی می‌شود.
            </p>
          )}
          {fullyWalletPaid && <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">مبلغ سفارش با اعتبار انتخاب‌شده پوشش داده می‌شود و نیازی به فیش بانکی نیست.</p>}

          <EmailBox
            show={!user?.email}
            email={email}
            setEmail={setEmail}
          />

          <RulesAgreement
            checked={rulesChecked}
            onChange={setRulesChecked}
          />

          {isOnline ? (
            <SubmitPaymentButton
              loading={submitLoading}
              disabled={!rulesChecked}
              onClick={handleOnlineSubmit}
              label="پرداخت آنلاین"
              loadingLabel="در حال انتقال به درگاه..."
            />
          ) : (
            <SubmitPaymentButton
              loading={submitLoading}
              disabled={(!fullyWalletPaid && receiptUrls.length === 0) || !rulesChecked}
              onClick={handleBankReceiptSubmit}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckoutPaymentPage;
