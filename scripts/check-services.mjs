/**
 * scripts/check-services.mjs — are the production services wired correctly?
 *
 *   npm run check:services                         uses .env
 *   node --env-file=.env.production scripts/check-services.mjs
 *   npm run check:services -- --mail you@example.com   also sends a test email
 *
 * Each service is tried for real (database connection, an ImageKit API call,
 * an SMTP login, Google's token endpoint) — but nothing is written and no
 * secret is printed. Exit code 1 when a required service fails.
 */
import mongoose from "mongoose";
import ImageKit from "imagekit";
import nodemailer from "nodemailer";

const env = process.env;
const mailTo = process.argv.includes("--mail") ? process.argv[process.argv.indexOf("--mail") + 1] : null;
let failed = false;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg, required = true) => {
  console.log(`  ${required ? "✗" : "!"} ${msg}`);
  if (required) failed = true;
};
const missing = (...keys) => keys.filter((k) => !env[k]);
const section = (title) => console.log(`\n── ${title}`);

section("آدرس سایت و کلیدهای ورود");
{
  const site = env.NEXT_PUBLIC_SITE_URL || "";
  if (!/^https:\/\/[^/]+$/.test(site)) bad(`NEXT_PUBLIC_SITE_URL باید https://دامنه باشد، بدون / آخر (الان: ${site || "خالی"})`);
  else ok(`آدرس سایت: ${site}`);
  if (env.NEXT_PUBLIC_BASE_URL !== site) bad("NEXT_PUBLIC_BASE_URL باید دقیقاً برابر NEXT_PUBLIC_SITE_URL باشد");
  for (const k of ["AccessTokenPrivateKey", "RefreshTokenPrivateKey", "CRON_SECRET"]) {
    if ((env[k] || "").length < 32) bad(`${k} باید یک رشته‌ی تصادفیِ حداقل ۳۲ کاراکتری باشد`);
  }
  if (env.AccessTokenPrivateKey && env.AccessTokenPrivateKey === env.RefreshTokenPrivateKey) bad("دو کلید ورود نباید یکسان باشند");
  if (env.ZARINPAL_SANDBOX === "1") bad("ZARINPAL_SANDBOX=1 است: پرداخت‌ها بدون پول واقعی موفق می‌شوند — در production پاکش کنید");
  if (!failed) ok("کلیدها تنظیم شده‌اند");
}

section("MongoDB");
if (!env.MONGODB_URI) bad("MONGODB_URI خالی است");
else {
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    ok(`اتصال برقرار شد (دیتابیس: ${mongoose.connection.name})`);
    if (hello.setName || hello.msg === "isdbgrid") ok("replica set است (تراکنش‌ها کار می‌کنند)");
    else bad("replica set نیست — ثبت محصول و پرداخت تراکنش لازم دارند (MongoDB Atlas همیشه replica set است)");
    const users = await mongoose.connection.db.collection("users").countDocuments();
    ok(`کاربران موجود: ${users}${users === 0 ? " — بعد از انتشار با npm run seed اولین ادمین را بسازید" : ""}`);
  } catch (err) {
    bad(`اتصال ناموفق: ${err.message}`);
    if (/whitelist|IP|ECONNREFUSED|timed out/i.test(err.message)) {
      console.log("    در Atlas → Network Access آدرس 0.0.0.0/0 را اضافه کنید (Vercel آی‌پیِ ثابت ندارد)");
    }
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

section("ImageKit (آپلود عکس)");
{
  const m = missing("IMAGEKIT_PUBLIC_KEY", "IMAGEKIT_PRIVATE_KEY", "IMAGEKIT_URL_ENDPOINT", "NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT");
  if (m.length) bad(`خالی: ${m.join("، ")}`);
  else {
    if (env.IMAGEKIT_URL_ENDPOINT !== env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT) bad("IMAGEKIT_URL_ENDPOINT و NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT باید یکی باشند");
    if (!/^https:\/\/ik\.imagekit\.io\//.test(env.IMAGEKIT_URL_ENDPOINT)) {
      bad("آدرس ImageKit با https://ik.imagekit.io/ شروع نمی‌شود؛ دامنه‌ی اختصاصی را به images.remotePatterns در next.config.mjs اضافه کنید", false);
    }
    try {
      const ik = new ImageKit({ publicKey: env.IMAGEKIT_PUBLIC_KEY, privateKey: env.IMAGEKIT_PRIVATE_KEY, urlEndpoint: env.IMAGEKIT_URL_ENDPOINT });
      await ik.listFiles({ limit: 1 });
      ok("کلیدها معتبرند");
    } catch (err) {
      bad(`کلیدها پذیرفته نشدند: ${err?.message || err}`);
    }
  }
}

section("ایمیل (SMTP)");
{
  const m = missing("EMAIL_HOST", "EMAIL_USER", "EMAIL_PASS", "EMAIL_FROM");
  if (m.length) bad(`خالی: ${m.join("، ")} — ایمیل تأیید سفارش و بازیابی رمز ارسال نمی‌شود`, false);
  else {
    const port = Number(env.EMAIL_PORT ?? 587);
    const transporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port,
      secure: port === 465,
      auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASS },
    });
    try {
      await transporter.verify();
      ok(`ورود به ${env.EMAIL_HOST}:${port} موفق بود`);
      if (!env.ADMIN_EMAIL) bad("ADMIN_EMAIL خالی است — ادمین ایمیلِ سفارشِ جدید نمی‌گیرد", false);
      if (mailTo) {
        await transporter.sendMail({ from: env.EMAIL_FROM, to: mailTo, subject: "آزمایش ایمیل فروشگاه", text: "اگر این را می‌بینید، ارسال ایمیل درست کار می‌کند." });
        ok(`ایمیل آزمایشی به ${mailTo} فرستاده شد`);
      }
    } catch (err) {
      bad(`ورود ناموفق: ${err.message}`, false);
      if (/gmail/i.test(env.EMAIL_HOST)) console.log("    برای Gmail باید «App password» بسازید (نه رمز خود حساب) و تأیید دومرحله‌ای روشن باشد");
    }
  }
}

section("ورود با گوگل");
{
  const m = missing("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET");
  if (m.length) bad(`خالی: ${m.join("، ")} — دکمه‌ی گوگل پیامِ «در دسترس نیست» می‌دهد`, false);
  else if (!/\.apps\.googleusercontent\.com$/.test(env.GOOGLE_CLIENT_ID)) bad("GOOGLE_CLIENT_ID باید به .apps.googleusercontent.com ختم شود", false);
  else {
    const redirect = `${env.NEXT_PUBLIC_BASE_URL}/api/auth/google/callback`;
    try {
      // a deliberately invalid code: Google answers invalid_grant only when the client id + secret are right
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code: "check", client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirect, grant_type: "authorization_code" }),
        signal: AbortSignal.timeout(10000),
      });
      const { error } = await res.json();
      if (error === "invalid_grant") ok("Client ID و Secret معتبرند");
      else if (error === "invalid_client" || error === "unauthorized_client") bad("Client ID یا Secret اشتباه است", false);
      else bad(`پاسخ غیرمنتظره از گوگل: ${error || res.status}`, false);
    } catch (err) {
      bad(`گوگل در دسترس نبود: ${err.message}`, false);
    }
    console.log(`    در Google Cloud → Credentials این آدرس را در «Authorized redirect URIs» ثبت کنید:\n    ${redirect}`);
  }
}

console.log(failed ? "\n✗ موارد ضروری مشکل دارند (✗). موارد «!» اختیاری‌اند." : "\n✓ سرویس‌های ضروری آماده‌اند. موارد «!» اختیاری‌اند.");
process.exit(failed ? 1 : 0);
