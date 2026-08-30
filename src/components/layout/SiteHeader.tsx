'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { appConfig, publicNav } from '@/config/app.config';
import { cn } from '@/lib/utils';

/** Split around the centered logo: 3 links left, 3 links right. */
const LEFT_HREFS = ['/', '/creations', '/songs'];
const RIGHT_HREFS = ['/services', '/about-us', '/contact'];

function byHrefs(hrefs: string[]) {
  return hrefs
    .map((href) => publicNav.find((item) => item.href === href))
    .filter((item): item is (typeof publicNav)[number] => Boolean(item));
}

export function SiteHeader({ siteName }: { siteName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  /*
   * The homepage hero runs up underneath this bar, so at the very top of that
   * page the bar goes transparent and borderless and lets the film through —
   * otherwise its background and bottom hairline cut a visible seam straight
   * across the top of the video.
   *
   * It has to come back as soon as the page moves, though: once the hero has
   * scrolled away the bar is floating over ordinary copy, and without its own
   * background the two would collide.
   */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const overHero = pathname === '/' && !scrolled && !open;

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const leftNav = byHrefs(LEFT_HREFS);
  const rightNav = byHrefs(RIGHT_HREFS);

  const navLinkClass = (href: string) =>
    cn(
      'rounded-pill px-4 py-2 text-[0.9375rem] transition-colors duration-200',
      isActive(href) ? 'bg-white/[0.08] text-site-fg' : 'text-site-muted hover:text-site-fg',
    );

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-colors duration-300',
        overHero
          ? 'border-b border-transparent bg-transparent'
          : 'border-b border-white/[0.06] bg-site-bg/85 backdrop-blur-xl',
      )}
    >
      <div className="container-page relative flex h-[4.5rem] items-center justify-between gap-6">
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {leftNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={navLinkClass(item.href)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/"
          className="absolute left-1/2 flex -translate-x-1/2 items-center"
          aria-label={siteName || appConfig.name}
        >
          <Image
            src="/brand/logo-wordmark-light.png"
            alt={siteName || appConfig.name}
            width={687}
            height={169}
            priority
            className="h-7 w-auto"
          />
        </Link>

        <div className="ml-auto flex items-center gap-1">
          <nav className="hidden items-center gap-1 md:flex" aria-label="Secondary">
            {rightNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={navLinkClass(item.href)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="-mr-2 grid size-11 place-items-center rounded-pill text-site-fg md:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5 stroke-current"
              fill="none"
              strokeWidth="1.75"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 8h16M4 16h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <nav className="border-t border-white/[0.06] bg-site-surface md:hidden" aria-label="Mobile">
          <div className="container-page flex flex-col gap-1 py-3">
            {[...leftNav, ...rightNav].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={cn(
                  'flex min-h-[2.75rem] items-center rounded-sm2 px-4 text-[0.9375rem]',
                  isActive(item.href)
                    ? 'bg-white/[0.08] text-site-fg'
                    : 'text-site-muted',
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
