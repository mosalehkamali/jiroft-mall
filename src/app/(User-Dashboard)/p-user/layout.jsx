import "@/app/globals.css"
import "./workspace.css"
import StoreHead from "@/components/common/StoreHead";
import storeConfig from "base/store.config";

import SiteNavbar from '@/components/features/navbar/SiteNavbar'
import { UserProvider } from '@/components/features/auth/UserContext'
import CartCleanup from '@/components/features/cart/CartCleanup'
import ScrollToTop from '@/components/common/ScrollToTop'
import NavigationLoader from '@/components/common/NavigationLoader'
import InitialLoadLoader from '@/components/common/InitialLoadLoader'
import DashboardBody from './DashboardBody'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

export const metadata = {
  title: "حساب کاربری",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

// سرور-کامپوننت تا <SiteNavbar /> بتواند navData را روی سرور بگیرد.
// بخش‌های stateful (سایدبار و ترنزیشن صفحه) در DashboardBody کلاینتی هستند.
export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning lang={storeConfig.brand.lang} dir={storeConfig.brand.dir}>
      <head>
        <StoreHead />
      </head>
      <body>
        <InitialLoadLoader />
        <NavigationLoader />
        <ScrollToTop />
        <CartCleanup />

        <div className="account-workspace font-sans">

          {/* منوی بالایی — نوبار اصلی سایت (جایگزین نوبار قدیمی داشبورد) */}
          <UserProvider>
            <DashboardBody shopMenu={<SiteNavbar />}>{children}</DashboardBody>
          </UserProvider>
        </div>
        <ToastContainer position="top-left" autoClose={3000} rtl />
      </body>
    </html>
  )
}
