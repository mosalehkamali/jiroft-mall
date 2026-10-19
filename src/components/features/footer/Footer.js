"use client";

import storeConfig from "base/store.config";
import { useState, useEffect } from "react";
import { FiMail, FiPhone, FiMapPin, FiInstagram, FiTwitter } from "react-icons/fi";
import { FaTelegram } from "react-icons/fa";
import { isFeatureEnabled, isHrefEnabled } from "@/lib/features";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Swal from "sweetalert2";
import Image from "next/image";
import Link from "next/link";

const { brand, navigation } = storeConfig;

const SOCIAL_ICONS = {
  instagram: <FiInstagram size={24} />,
  telegram: <FaTelegram size={24} />,
  x: <FiTwitter size={24} />,
};

// Links into a disabled feature are dropped; an emptied column disappears.
const FOOTER_SECTIONS = (navigation?.footer || [])
  .map((section) => ({ ...section, links: (section.links || []).filter((l) => isHrefEnabled(l.href)) }))
  .filter((section) => section.links.length > 0);

const SOCIALS = Object.entries(brand.social || {}).filter(([key, href]) => href && SOCIAL_ICONS[key]);

export default function Footer() {
  const newsletter = isFeatureEnabled("newsletter");
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // بررسی وضعیت کوکی هنگام لود شدن صفحه
  useEffect(() => {
    const cookies = document.cookie.split("; ");
    const hasSubscribed = cookies.find((row) => row.startsWith("newsletter_subscribed="));
    if (hasSubscribed) {
      setIsSubscribed(true);
    }
  }, []);

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "خطایی رخ داد");

      setIsSubscribed(true);

      Swal.fire({
        icon: "success",
        title: "عضویت موفق",
        text: "از همراهی شما سپاسگزاریم!",
        confirmButtonColor: "var(--color-primary)",
        background: "var(--color-dark)",
        color: "#ffffff",
      });

      setEmail("");
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "خطا",
        text: err.message,
        confirmButtonColor: "var(--color-primary)",
        background: "var(--color-dark)",
        color: "#ffffff",
      });
    } finally {
      setLoading(false);
    }
  };

  const contact = brand.contact || {};

  return (
    <footer className="bg-[var(--color-dark)] text-white border-t border-white/10">
      {newsletter ? (
        <div className="border-b border-white/5">
          <div className="container mx-auto px-4 py-12">
            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="text-2xl font-bold mb-2 text-white">
                    {isSubscribed ? "شما عضو خبرنامه هستید" : "عضویت در خبرنامه"}
                  </h3>
                  <p className="text-gray-400">
                    {isSubscribed
                      ? "از اینکه ما را دنبال می‌کنید سپاسگزاریم."
                      : "از جدیدترین محصولات و تخفیف‌های ویژه با خبر شوید"}
                  </p>
                </div>

                {!isSubscribed ? (
                  <form onSubmit={handleNewsletterSubmit} className="flex gap-3">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ایمیل خود را وارد کنید"
                      required
                      className="flex-grow bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-[var(--color-primary)]"
                    />
                    <Button
                      type="submit"
                      disabled={loading}
                      className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-8"
                    >
                      {loading ? "در حال ثبت..." : "عضویت"}
                    </Button>
                  </form>
                ) : (
                  <div className="flex items-center justify-center p-4 bg-green-900/20 border border-green-500/30 rounded-2xl text-green-500 font-bold">
                    ✓ با موفقیت اشتراک فعال شد
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12">
          <div className="lg:col-span-2">
            <div className="mb-6 opacity-90">
              <Image src={brand.logo} alt={brand.name} width={120} height={120} />
            </div>
            <p className="text-gray-400 mb-8 leading-relaxed text-sm">{brand.description}</p>

            <div className="space-y-4">
              {[
                [FiMail, contact.email, contact.email && `mailto:${contact.email}`],
                [FiPhone, contact.phone, contact.phone && `tel:${contact.phone}`],
                [FiMapPin, contact.address, null],
              ]
                .filter(([, value]) => value)
                .map(([Icon, value, href]) => (
                  <div key={value} className="flex items-center gap-3 text-gray-300 hover:text-white transition-colors group">
                    <Icon className="text-[var(--color-primary)] group-hover:scale-110 transition-transform" size={20} />
                    {href ? (
                      <a href={href} className="text-sm" dir="ltr">{value}</a>
                    ) : (
                      <span className="text-sm">{value}</span>
                    )}
                  </div>
                ))}
            </div>

            {SOCIALS.length ? (
              <div className="flex gap-5 mt-8">
                {SOCIALS.map(([key, href]) => (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={key}
                    className="text-white hover:text-[var(--color-primary)] transition-all duration-300 ease-in-out transform hover:-translate-y-1"
                  >
                    {SOCIAL_ICONS[key]}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-white font-bold mb-6 pb-2 border-b border-[var(--color-primary)] inline-block">
                {section.title}
              </h3>
              <ul className="space-y-4">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-gray-400 hover:text-[var(--color-primary)] transition-colors block text-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="container mx-auto px-4 py-6">
          <p className="text-xs text-gray-500 text-center md:text-start">
            © {new Date().getFullYear()} — تمامی حقوق برای {brand.name} محفوظ است.
          </p>
        </div>
      </div>
    </footer>
  );
}
