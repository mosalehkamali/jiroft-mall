# راهنمای انتشار (Production)

**مرحله‌ی الف** (الان): سایت روی Vercel با پرداختِ کارت‌به‌کارت، دیتابیس MongoDB Atlas، آپلود عکس با
ImageKit، ایمیل و ورود با گوگل.
**مرحله‌ی ب** (بعداً): اتصال حساب‌های محک و درگاه زرین‌پال.

همه‌ی کلیدها در فایل `.env` هستند که در همین مخزنِ **خصوصی** commit شده است — مخزن را هرگز عمومی نکنید و کلیدها را در چت نفرستید. متغیرهایی که در تنظیمات Vercel بگذارید بر مقادیرِ فایل اولویت دارند.

---

# مرحله‌ی الف — راه‌اندازی روی Vercel

## ۱. دیتابیس: MongoDB Atlas

1. در [cloud.mongodb.com](https://cloud.mongodb.com) یک کلاستر رایگان (**M0**) بسازید.
   منطقه را **AWS / Frankfurt (eu-central-1)** بگذارید تا با سرورِ Vercel (مرحله‌ی ۵) کنار هم باشند.
2. **Database Access** → یک کاربر با رمزِ قوی بسازید.
3. **Network Access** → `0.0.0.0/0` را اضافه کنید (Vercel آی‌پیِ ثابت ندارد؛ امنیت با رمزِ کاربر است).
4. **Connect → Drivers** → آدرس را کپی کنید و نام دیتابیس را قبل از `?` اضافه کنید:

```
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/jiroft-mall?retryWrites=true&w=majority
```

Atlas همیشه replica set است، که برای ثبت محصول و پرداخت لازم است.
اگر سایت Atlas از داخل ایران باز نشد، ثبت‌نام و مدیریتش را با اتصالِ خارج انجام دهید؛ اتصالِ خودِ سایت از سرور Vercel است.

## ۲. آپلود عکس: ImageKit

1. در [imagekit.io](https://imagekit.io) حساب بسازید.
2. **Developer options → API keys**: سه مقدار را بردارید.

```
IMAGEKIT_PUBLIC_KEY=public_...
IMAGEKIT_PRIVATE_KEY=private_...
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/شناسه‌ی-شما
NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/شناسه‌ی-شما
```

دو آدرسِ آخر یکی‌اند. بدونِ ImageKit هیچ عکسی آپلود نمی‌شود.

## ۳. ایمیل: Gmail

برای شروع یک حساب Gmail کافی است (حدود ۵۰۰ ایمیل در روز):

1. در حساب گوگل **تأیید دومرحله‌ای (2-Step Verification)** را روشن کنید.
2. **App passwords** → یک رمزِ ۱۶ حرفی بسازید. این رمز را می‌گذارید، **نه** رمزِ خودِ حساب.

```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_USER=آدرس@gmail.com
EMAIL_PASS=رمز-۱۶-حرفیِ-App-password
EMAIL_FROM="جیرفت مال <آدرس@gmail.com>"
ADMIN_EMAIL=ایمیلِ-خودتان-برای-خبرِ-سفارشِ-جدید
NEXT_PUBLIC_LOGO_URL=https://آدرسِ-یک-لوگوی-PNG     # بیشتر ایمیل‌خوان‌ها SVG نشان نمی‌دهند
```

`EMAIL_FROM` باید همان آدرسِ `EMAIL_USER` باشد، وگرنه Gmail آن را عوض می‌کند یا اسپم می‌شود.

## ۴. ورود با گوگل

در [console.cloud.google.com](https://console.cloud.google.com):

1. یک پروژه بسازید.
2. **OAuth consent screen**: نوع **External**، نام فروشگاه، ایمیلِ پشتیبانی، و دامنه‌ی سایت در «Authorized domains».
   بعد **Publish app** را بزنید — تا در حالت «Testing» است فقط کاربرانِ آزمایشی می‌توانند وارد شوند.
   (دسترسی‌های ایمیل و نام «حساس» نیستند و بررسیِ گوگل لازم ندارند.)
3. **Credentials → Create credentials → OAuth client ID**، نوع **Web application**:
   - Authorized JavaScript origins: `https://دامنه`
   - Authorized redirect URIs: `https://دامنه/api/auth/google/callback`

```
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

اگر بعداً دامنه عوض شد، این دو آدرس را هم در گوگل عوض کنید.

## ۵. Vercel

1. در [vercel.com](https://vercel.com) → **Add New → Project** → مخزنِ GitHub را import کنید (تنظیماتِ build پیش‌فرض درست است).
2. **پیش از اولین deploy** در **Settings → Environment Variables** این‌ها را (برای Production) بگذارید:

```
MONGODB_URI=
AccessTokenPrivateKey=        # رشته‌ی تصادفی
RefreshTokenPrivateKey=       # رشته‌ی تصادفیِ دیگر
CRON_SECRET=                  # رشته‌ی تصادفیِ سوم
NEXT_PUBLIC_SITE_URL=https://دامنه
NEXT_PUBLIC_BASE_URL=https://دامنه
+ همه‌ی مقادیرِ بخش‌های ۲، ۳ و ۴
```

ساختِ رشته‌ی تصادفی (هر بار یکی):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

3. **Settings → Functions → Function Region** را **Frankfurt (fra1)** بگذارید — همان منطقه‌ی دیتابیس.
4. **Settings → Domains** → دامنه را اضافه کنید و رکوردهای DNS را که Vercel می‌گوید در پنلِ دامنه ثبت کنید.

> متغیرهای `NEXT_PUBLIC_*` هنگامِ **build** در کد قرار می‌گیرند. هر بار که یکی را عوض کردید
> (مثلاً آدرسِ سایت بعد از وصل‌کردنِ دامنه)، از **Deployments → Redeploy** دوباره بسازید.

## ۶. قبل و بعد از اولین deploy — روی کامپیوتر خودتان

یک فایل `.env` بسازید با **همان** مقادیرِ Vercel (همان `MONGODB_URI` و بقیه). بعد:

همه‌ی سرویس‌ها را واقعاً امتحان می‌کند (دیتابیس، ImageKit، ورود به Gmail، کلیدهای گوگل) و چیزی نمی‌نویسد:

```bash
npm run check:services
```

با یک ایمیلِ آزمایشی به آدرسِ خودتان:

```bash
npm run check:services -- --mail you@example.com
```

ایندکس‌های دیتابیس (در برنامه خودکار ساخته نمی‌شوند):

```bash
npm run ensure:indexes
```

**اولین ادمین:** `SUPER_ADMIN_EMAIL` را در Vercel بگذارید (ایمیلِ گوگلِ خودتان). اولین بار که با
همان حساب از «ادامه با گوگل» وارد شوید، ادمینِ اصلی با دسترسیِ کامل می‌شوید — فقط تا وقتی فروشگاه هیچ ادمینی
ندارد، و فقط با ورودِ گوگل (ایمیلی که گوگل تأییدش کرده). بعد از آن این متغیر کاری نمی‌کند و ادمین‌های بعدی را از پنل اضافه کنید.

راهِ جایگزین، از کامپیوتر خودتان — **بدون `--demo`**، وگرنه کاتالوگِ نمونه وارد دیتابیسِ اصلی می‌شود:

```bash
npm run seed -- --phone 09xxxxxxxxx --password "…" --name "…"
```

## ۷. در پنل ادمین

- **شماره‌ی کارت/حساب** برای کارت‌به‌کارت — بدون آن مشتری نمی‌داند کجا واریز کند.
- **صفحات سایت**: قوانین، بازگشت کالا، ارسال، درباره‌ی ما.
- `store.config.js` → `brand.contact` و `brand.social` (تلفن، ایمیل، آدرس — الان خالی‌اند).

## ۸. آزمایشِ نهایی

1. ثبت‌نام با شماره‌ی موبایل، و یک ورود با گوگل.
2. «فراموشیِ رمز» با ایمیل → ایمیل برسد.
3. آپلودِ عکسِ یک محصول در پنل.
4. یک خریدِ کارت‌به‌کارت → تأییدِ رسید در پنل → ایمیلِ تأیید برسد.

---

# مرحله‌ی ب — بعداً

## محک

متغیرهای `MAHAK_SHOES_*` و `MAHAK_CLOTHING_*` را در Vercel و `.env` بگذارید، بعد روی کامپیوتر خودتان:

```bash
npm run mahak:inspect
```

```bash
npm run mahak:sync
```

از خروجیِ اولی معلوم می‌شود قیمت‌ها ریال‌اند یا تومان (`priceDivisor` در `store.config.js` → `integrations.mahak`).
دسترسی به API محک از سرورِ Vercel (خارج از ایران) هنوز امتحان نشده است.

**همگام‌سازیِ ساعتی:** پلنِ رایگانِ Vercel cron را فقط روزی یک بار اجرا می‌کند، برای همین در `vercel.json`
همگام‌سازیِ محک روزانه است. برای ساعتی، یکی از این دو:
- پلن Pro و برگرداندنِ `schedule` به `0 * * * *` در `vercel.json`؛
- یا سرویسی مثل [cron-job.org](https://cron-job.org) که هر ساعت این را صدا بزند:

```
GET https://دامنه/api/cron/mahak-sync
Authorization: Bearer <CRON_SECRET>
```

## زرین‌پال

کدِ پرداختِ آنلاین آماده و آزموده است؛ فقط خاموش است. برای روشن‌کردن:

1. مرچنت‌کد و **اینماد** برای دامنه.
2. **IP ثابت.** زرین‌پال ترمینال را به IP سرور گره می‌زند (در آزمایش پیامِ `Terminal ip not valid` آمد) و
   Vercel به‌طور پیش‌فرض IP خروجیِ ثابت ندارد. یعنی برای درگاه یا باید سرویسِ IP ثابتِ Vercel را بگیرید، یا سایت
   را به سروری با IP ثابت ببرید (VPS، لیارا، ابر آروان). پیش از تصمیم، از همان سرور امتحان کنید:

```bash
curl -s -X POST https://payment.zarinpal.com/pg/v4/payment/request.json -H "Content-Type: application/json" -d "{}"
```

3. `ZARINPAL_MERCHANT_ID` را بگذارید و در `store.config.js`:

```js
paymentMethods: ["ONLINE", "BANK_RECEIPT"],
```

> `ZARINPAL_SANDBOX=1` یعنی پرداخت **بدون پولِ واقعی** موفق می‌شود — فقط برای آزمایش، هرگز در production.
> `npm run check:services` اگر روشن باشد خطا می‌دهد.

## کارهای زمان‌بندی‌شده (همه)

| آدرس | زمان | کار |
|---|---|---|
| `/api/cron/mahak-sync` | روزانه (بهتر: ساعتی) | کالا، قیمت، موجودیِ محک؛ ارسالِ دوباره‌ی فاکتورهای ناموفق؛ لغوِ سفارش‌های آنلاینِ پرداخت‌نشده |
| `/api/cron/review-followup` | روزانه | «سفارش به دستتان رسید؟» |
| `/api/cron/wallet-notifications` | روزانه | فقط با کیف پولِ روشن |
| `/api/cron/installment-reminders` | روزانه | فقط با فروشِ اقساطیِ روشن |

روی Vercel خودکار اجرا می‌شوند (`CRON_SECRET` باید تنظیم باشد). روی میزبانِ دیگر با `crontab` یا cron-job.org،
با هدرِ `Authorization: Bearer <CRON_SECRET>`.
