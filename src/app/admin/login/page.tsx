import type { Metadata } from 'next';
import Image from 'next/image';

import { LoginBackdrop } from '@/components/admin/LoginBackdrop';
import { LoginForm } from '@/components/admin/LoginForm';

export const metadata: Metadata = {
  title: 'Sign in — Rejoice Admin',
  robots: { index: false, follow: false },
};

/**
 * Administrator sign-in, built as the homepage hero's composition.
 *
 * The film runs full-bleed and the content floats on it with no card — the
 * wordmark where the hero puts its record, the form where the hero puts its
 * headline.
 *
 * ## Why the stack sits high rather than centred
 *
 * `(public)/page.tsx` records a measurement off the footage: the horizon is at
 * ~55% of the frame, and copy placed over the seated figures below it "reads as
 * clutter". So this column is pinned toward the top of the viewport instead of
 * being vertically centred, which keeps it on the night sky and off the fire.
 *
 * `justify-center` below `sm` because on a short phone screen there is no sky to
 * aim for — `object-cover` has cropped to the middle of the frame by then — and
 * a form pinned high with a long empty space under it reads worse than a
 * centred one. The backdrop compensates with a heavier scrim at those widths.
 */
export default function LoginPage({ searchParams }: { searchParams: { from?: string } }) {
  return (
    <div className="relative flex min-h-screen justify-center px-4 py-10 max-sm:items-center sm:pt-[9vh] lg:pt-[7vh]">
      <LoginBackdrop />

      {/* Above the film. See the stacking note in `LoginBackdrop`. */}
      <div className="relative z-10 w-full max-w-[22rem]">
        <div className="text-center">
          {/*
           * The wordmark takes the record's place at the top of the stack. The
           * light version, since it sits on the night sky under a scrim.
           */}
          <Image
            src="/brand/logo-wordmark-light.png"
            alt="Rejoice"
            width={687}
            height={169}
            priority
            className="mx-auto h-8 w-auto sm:h-9"
          />
          {/*
           * The hero's eyebrow slot ("PLAY THE TRACK"), carrying the one thing
           * this screen needs to say. Same treatment: small, spaced, uppercase.
           */}
          <p className="mt-5 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-panel-muted">
            Administrator sign in
          </p>
        </div>

        <div className="mt-7">
          <LoginForm from={searchParams.from} />
        </div>

        <p className="mt-8 text-center text-xs text-panel-muted">
          This area is for the Rejoice administrator only.
        </p>
      </div>
    </div>
  );
}
