import Image from 'next/image';
import Link from 'next/link';

import { appConfig, publicNav } from '@/config/app.config';
import type { ContactDetails } from '@/features/content/queries';

export function SiteFooter({ contact, siteName }: { contact: ContactDetails; siteName: string }) {
  // Already filtered to non-empty URLs by getContactDetails.
  const socials = contact.socials;

  return (
    <footer className="mt-24 border-t border-white/[0.06] bg-site-surface">
      <div className="container-page grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Image
            src="/brand/logo-wordmark-light.png"
            alt={siteName || appConfig.name}
            width={687}
            height={169}
            className="h-7 w-auto"
          />
          <p className="mt-4 max-w-xs text-body leading-[1.7] text-site-muted">
            {appConfig.tagline}. Recorded, mixed and filmed for the church.
          </p>
        </div>

        <nav className="lg:col-span-2" aria-label="Footer">
          <p className="t-label">Pages</p>
          <ul className="mt-5 space-y-3">
            {publicNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-body text-site-muted transition-colors hover:text-site-fg"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lg:col-span-3">
          <p className="t-label">Reach us</p>
          <ul className="mt-5 space-y-3 text-body text-site-muted">
            {contact.email ? (
              <li>
                <a
                  href={`mailto:${contact.email}`}
                  className="[overflow-wrap:anywhere] transition-colors hover:text-site-accent"
                >
                  {contact.email}
                </a>
              </li>
            ) : null}
            {contact.phone ? (
              <li>
                <a
                  href={`tel:${contact.phone.replace(/\s/g, '')}`}
                  className="tabular-nums transition-colors hover:text-site-accent"
                >
                  {contact.phone}
                </a>
              </li>
            ) : null}
            {contact.address ? <li className="whitespace-pre-line">{contact.address}</li> : null}
          </ul>
        </div>

        {socials.length > 0 ? (
          <div className="lg:col-span-3">
            <p className="t-label">Follow</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-pill border border-white/10 px-4 py-1.5 text-sm text-site-muted transition-colors hover:border-site-accent hover:text-site-accent"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/[0.06]">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-6 text-label uppercase tracking-[0.08em] text-site-muted">
          <span>
            © {new Date().getFullYear()} {siteName || appConfig.name}
          </span>
          <span>Every recording lives on YouTube</span>
        </div>
      </div>
    </footer>
  );
}
