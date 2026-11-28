import storeConfig from "base/store.config";
import { FiMail, FiPhone, FiMapPin, FiInstagram, FiTwitter, FiYoutube, FiLinkedin } from "react-icons/fi";
import { FaTelegram, FaWhatsapp } from "react-icons/fa";
import { isHrefEnabled } from "@/lib/features";
import { defaultSiteFooter, renderCopyright, SOCIAL_PLATFORMS, telHref } from "@/lib/siteFooter";
import Image from "next/image";
import Link from "next/link";

const { brand } = storeConfig;

const SOCIAL_ICONS = {
  instagram: FiInstagram,
  telegram: FaTelegram,
  whatsapp: FaWhatsapp,
  x: FiTwitter,
  youtube: FiYoutube,
  linkedin: FiLinkedin,
};

const SOCIAL_LABELS = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, p.label]));

/** `footer` comes from the (Site) layout (Admin → صفحات سایت → فوتر). */
export default function Footer({ footer = defaultSiteFooter() }) {
  // Links into a disabled feature are dropped; an emptied column disappears.
  const sections = footer.sections
    .map((section) => ({ ...section, links: section.links.filter((l) => isHrefEnabled(l.href)) }))
    .filter((section) => section.links.length > 0);
  const socials = footer.socials.filter((s) => s.enabled && s.url && SOCIAL_ICONS[s.key]);

  // Phone and address sit above the email. Phone numbers and emails are LTR text inside an RTL row:
  // `dir="ltr"` isolates them, so "+98 912 …" never renders reversed.
  const contactRows = [
    ...footer.phones.map((phone) => [FiPhone, phone, telHref(phone), true]),
    [FiMapPin, footer.address, null, false],
    [FiMail, footer.email, footer.email && `mailto:${footer.email}`, true],
  ].filter(([, value]) => value);

  return (
    <footer className="bg-[var(--color-dark)] text-white border-t border-white/10">

      <div className="site-container py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12">
          <div className="lg:col-span-2">
            {footer.logo ? (
              <div className="mb-6 opacity-90">
                <Image src={footer.logo} alt={brand.name} width={120} height={120} />
              </div>
            ) : null}
            {footer.description ? (
              <p className="text-gray-300 mb-8 leading-relaxed text-sm whitespace-pre-line">{footer.description}</p>
            ) : null}

            <div className="space-y-4">
              {contactRows.map(([Icon, value, href, ltr]) => (
                <div key={value} className="flex items-center gap-3 text-gray-300 hover:text-white transition-colors group">
                  <Icon className="shrink-0 text-[var(--color-primary)] group-hover:scale-110 transition-transform" size={20} />
                  {href ? (
                    <a href={href} className="text-sm" dir={ltr ? "ltr" : undefined}>{value}</a>
                  ) : (
                    <span className="text-sm leading-relaxed">{value}</span>
                  )}
                </div>
              ))}
            </div>

            {socials.length ? (
              <div className="flex gap-5 mt-8">
                {socials.map(({ key, url }) => {
                  const Icon = SOCIAL_ICONS[key];
                  return (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${SOCIAL_LABELS[key]} ${brand.name}`}
                      className="text-white hover:text-[var(--color-primary)] transition-all duration-300 ease-in-out transform hover:-translate-y-1"
                    >
                      <Icon size={24} />
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>

          {sections.map((section, i) => (
            <div key={`${section.title}-${i}`}>
              <h3 className="text-white font-bold mb-6 pb-2 border-b border-[var(--color-primary)] inline-block">
                {section.title}
              </h3>
              <ul className="space-y-4">
                {section.links.map((link, j) => (
                  <li key={`${link.href}-${j}`}>
                    <Link
                      href={link.href}
                      className="text-gray-300 hover:text-white transition-colors block text-sm"
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

      {footer.copyright ? (
        <div className="border-t border-white/5">
          <div className="site-container py-6">
            <p className="text-xs text-gray-300 text-center">{renderCopyright(footer.copyright)}</p>
          </div>
        </div>
      ) : null}
    </footer>
  );
}
