import storeConfig from "base/store.config";
import '@/app/globals.css';
import StoreHead from "@/components/common/StoreHead";
import '@/styles/admin-theme.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AdminLayout from "@/components/admin/Layout"
import { NotificationProvider } from "@/components/admin/NotificationProvider"
import SiteNavbar from "@/components/features/navbar/SiteNavbar"
import ScrollToTop from "@/components/common/ScrollToTop"
import NavigationLoader from "@/components/common/NavigationLoader"
import InitialLoadLoader from "@/components/common/InitialLoadLoader"
import AdminSWRConfig from "@/components/admin/AdminSWRConfig"
import { AdminPermissionProvider } from "@/components/admin/AdminPermissionProvider"
import { getAdminContext } from "@/lib/adminContext"
import { deriveDisplayName } from "@/lib/adminGuards"

export const metadata = {
  title: `${storeConfig.brand.name} | پنل مدیریت`,
  description: `پنل مدیریت یکپارچه ${storeConfig.brand.name}`,
  icons: { icon: storeConfig.brand.favicon, shortcut: storeConfig.brand.favicon, apple: storeConfig.brand.favicon },
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function RootLayout({ children }) {
  // دسترسیِ مؤثر همین‌جا روی سرور حل می‌شود تا اولین رنگِ HTML هم درست باشد
  // (بدون flash). نبودِ ctx یعنی نشست ادمین نیست — middleware همین‌جا هم
  // rewrite کرده، ولی چرومِ پنل را برایش رندر نمی‌کنیم (fail-closed دوم).
  const ctx = await getAdminContext();

  if (!ctx) {
    return (
      <html lang={storeConfig.brand.lang} dir={storeConfig.brand.dir} className="scroll-smooth">
        <head><StoreHead /></head>
        <body
          className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] antialiased"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          <main className="min-h-screen overflow-x-hidden">
            <SiteNavbar />
            <div className="admin-scope">{children}</div>
          </main>
        </body>
      </html>
    );
  }

  const admin = {
    name: deriveDisplayName(ctx.user),
    title: ctx.membership?.title || ctx.role?.name || 'مدیریت',
  };

  return (
    <html lang={storeConfig.brand.lang} dir={storeConfig.brand.dir} className="scroll-smooth">
      <head>
        <StoreHead />
      </head>
      <body
        className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] antialiased"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        <InitialLoadLoader />
        <NavigationLoader />
        <ScrollToTop />
        <main className="min-h-screen overflow-x-hidden">
          {/* نوبار سایت — رنگ‌های سایت (خارج از admin-scope) دست‌نخورده می‌مانند */}
          <SiteNavbar />
          {/* از این‌جا به بعد داخل admin-scope هستیم: پریمری = سبز درباری، رادیوس = ۶ پیکسل */}
          <div className="admin-scope">
            <AdminPermissionProvider
              permissions={ctx.permissions}
              isFullAccess={ctx.isFullAccess}
              admin={admin}
            >
              <AdminSWRConfig>
                <NotificationProvider>
                  <AdminLayout>{children}</AdminLayout>
                </NotificationProvider>
              </AdminSWRConfig>
            </AdminPermissionProvider>
          </div>
        </main>

        <ToastContainer
          position="top-left"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </body>
    </html>
  );
}
