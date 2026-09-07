'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { VinylDisc } from './VinylDisc';

/**
 * Hero record — a vinyl disc that plays a track when clicked and turns while it
 * plays.
 *
 * Two things here are load-bearing and easy to "tidy" into breakage:
 *
 *   1. The spin is applied permanently and toggled with `animation-play-state`,
 *      never by adding and removing the animation class. `paused` freezes the
 *      disc at its current angle and resumes from there; removing the animation
 *      would snap it back to 0deg every time you pause, which no record does.
 *
 *   2. The label carries an off-centre arc mark. A disc of concentric dot rings
 *      is rotationally near-symmetric, so without one asymmetric feature the
 *      spin is invisible — the rings just shimmer and the whole thing looks
 *      broken. The mark is what makes the rotation legible.
 *
 * Reduced motion needs no code here: the global rule in `globals.css` freezes
 * the spin and the tonearm transition on its own. Audio still plays, so the
 * control still works — it degrades to a still composition rather than
 * disappearing. The caption and the accent rim below carry the playing state
 * without motion, which is why they exist.
 */
export function HeroRecord({ src, className }: { src: string; className?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [broken, setBroken] = useState(false);


  /*
   * The audio element is the source of truth; this state only mirrors it. Every
   * transition is driven by the element's own events, so a rejected play(), a
   * track ending on its own, or the OS pausing us for a phone call all land in
   * the right state without special-casing any of them.
   */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    const onError = () => {
      setBroken(true);
      setPlaying(false);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      // Don't leave the track playing into a page the visitor has left.
      audio.pause();
    };
  }, []);

  /*
   * Autoplay, stop off screen, resume on return — and a manual stop that sticks.
   *
   * ## The one thing that is not in our gift
   *
   * Browsers refuse audible autoplay until the visitor has interacted with the
   * document. Verified here, not assumed — the real component's `play()` on load
   * returns:
   *
   *     NotAllowedError: play() failed because the user didn't interact
   *     with the document first
   *
   * Chrome relaxes this once a visitor's Media Engagement Index for the site is
   * high enough, which is why it can appear to work for a regular visitor and
   * fail for everyone else. Safari and Firefox are stricter.
   *
   * So there are two paths, and the first one that succeeds wins:
   *
   *   1. Ask outright on mount. Works for returning visitors Chrome trusts.
   *   2. If refused, wait for the visitor's FIRST interaction of any kind —
   *      pointer, key, touch or scroll — and start then. That is the earliest
   *      moment the browser will allow it.
   *
   * ## Who is allowed to start and stop it
   *
   * `userStopped` is the whole state machine. Scrolling away pauses the track but
   * does NOT set it, so scrolling back resumes. Pressing the control to pause
   * DOES set it, and from then on nothing automatic will start the track again —
   * not scrolling back, not a later interaction. Only pressing play, or a page
   * reload, clears it.
   */
  const userStopped = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    const root = rootRef.current;
    if (!audio || !root) return;

    let visible = false;

    /*
     * `audio.paused` IS NOT "is it playing", and nothing here may treat it as
     * though it were.
     *
     * `play()` sets `paused` to false synchronously and settles its promise
     * later, so between a refused attempt and its rejection the element reports
     * `paused === false` while making no sound at all. Guarding on it therefore
     * skips exactly the attempt that would have worked. `play()` on an element
     * that is genuinely already playing simply resolves, so there is nothing
     * worth guarding against in the first place.
     */
    const start = () => {
      if (userStopped.current || !visible) return;
      void audio.play().catch(() => {});
    };

    /*
     * Armed if the browser refuses the first attempt.
     *
     * NOT `once: true`, and this is the second version — the first used it and
     * had a race that showed up in testing. Reloading the page and scrolling
     * left the track silent, because a one-shot listener is spent by the first
     * interaction whether or not the track actually started. If that interaction
     * arrives before React has mounted this effect, or before the observer's
     * first callback has set `visible`, the single chance is gone and nothing
     * ever starts it.
     *
     * So these stay armed and keep trying, and are removed only once `play()`
     * has actually RESOLVED — success is the exit condition, not "an event fired".
     *
     * NO `scroll`. It used to be here, with a comment claiming it "counts as
     * interaction for the autoplay policy" — it does not, in any engine, and
     * `ShortsFeed.tsx` says so correctly a few files away: "Scrolling is
     * deliberately NOT treated as that gesture: Chrome does not count it." All a
     * scroll could ever do here is spend a turn on a `play()` the browser was
     * always going to refuse. The case it was reaching for — the hero coming
     * back into view — belongs to the IntersectionObserver below, which already
     * handles it.
     */
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;

    const disarm = () => {
      for (const type of events) window.removeEventListener(type, onInteraction);
    };

    /*
     * Deliberately NOT gated on `audio.paused` — see the note on `start` above.
     *
     * DEFENSIVE, not a fix for anything observed, and worth saying so rather
     * than letting a future reader assume it was load-bearing. Measured against
     * Chromium with autoplay blocked, clicking away from the record at 120, 200,
     * 300, 450 and 700ms after navigation: the track started every time, with
     * the guard and without it. The guard is still wrong in principle — it can
     * only ever drop the one attempt that would have worked — but the in-flight
     * window is plainly narrower than a real visitor's first click.
     *
     * `toggle` is where the same unsound read did cause a reproducible failure.
     */
    function onInteraction() {
      if (userStopped.current) {
        disarm();
        return;
      }
      if (!visible) return;
      audio!.play().then(disarm, () => {});
    }

    const armInteraction = () => {
      for (const type of events) {
        window.addEventListener(type, onInteraction, { passive: true });
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          start();
        } else if (!audio.paused) {
          /*
           * Off screen, so pause — the record IS the only control, and music
           * playing with no visible way to stop it is both rude and a WCAG 1.4.2
           * failure. Deliberately does not touch `userStopped`: this is our
           * decision, not the visitor's, so returning to the hero resumes.
           */
          audio.pause();
        }
      },
      { threshold: 0 },
    );
    observer.observe(root);

    // Path 1, immediately; path 2 armed only if path 1 is refused.
    audio.play().then(
      () => {},
      () => armInteraction(),
    );

    return () => {
      observer.disconnect();
      disarm();
    };
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    /*
     * Branched on `playing`, not `audio.paused`.
     *
     * `playing` is the mirror of the element's own `play`/`pause` events, which
     * this file already treats as the source of truth. `paused` is false the
     * instant `play()` is called, including for an attempt the browser is about
     * to refuse — so on a first visit a press landing in that window read as
     * "already playing", took the else branch, and latched `userStopped`. The
     * visitor's first press of the record would have STOPPED a track that had
     * never made a sound, and nothing automatic would have started it again.
     */
    if (!playing) {
      // Pressing play clears the manual stop, so the automatic behaviour is
      // handed back — scrolling away will pause it and scrolling back resumes.
      userStopped.current = false;
      // play() rejects on a decode failure or a missing file. The listeners
      // above already put us back in the right state, so there is deliberately
      // nothing to do here — notably NOT setPlaying(true), which would leave a
      // disc spinning silently over audio that never started.
      void audio.play().catch(() => {});
    } else {
      // A deliberate stop. Nothing automatic starts the track after this.
      userStopped.current = true;
      audio.pause();
    }
    /* `playing` is read above, so it has to be a dependency: with an empty array
       this would close over `false` for the life of the component and the button
       could only ever start the track, never stop it. */
  }, [playing]);

  // Nothing configured yet — render nothing rather than a control that can't work.
  if (!src) return null;

  return (
    <div
      ref={rootRef}
      className={cn('flex flex-col items-center gap-3', className)}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={broken}
        aria-pressed={playing}
        /*
         * Kept in step with the visible caption below the disc. WCAG 2.5.3
         * (Label in Name) wants the accessible name to contain the visible text,
         * and someone driving the page by voice says what they can see — "click
         * Play the song". A name still reading "track" would not match.
         */
        aria-label={playing ? 'Pause the song' : 'Play the song'}
        data-playing={playing ? 'true' : 'false'}
        className={cn(
          'group relative rounded-pill transition-opacity duration-200',
          /*
           * Sized to the clip's *sky*, not the viewport. The horizon sits at
           * ~55% of the frame (measured off the footage, not guessed), and the
           * record and headline both have to land above it — over people's
           * faces they read as clutter. Since the film is 16:9, that sky is a
           * fixed fraction of viewport width, so the budget shrinks fast as the
           * window narrows and the record is what gives way.
           *
           * Below `lg` none of this applies: the two stack above the film on
           * the navy panel, with no horizon to avoid.
           *
           * When the budget gets tight the *headline* gives way, not the
           * record — see the responsive type size on the `h1` in `page.tsx`.
           * The record is the element worth protecting here; the headline is
           * long enough to survive a couple of points.
           */
          /*
           * It grows to `lg` and then steps back down at `xl`. That looks
           * backwards until you remember what changes at `xl`: the record
           * stops sitting on a plain panel and moves onto the film, where it
           * has to share the clip's sky with a three-line headline. The sky is
           * a fixed fraction of the window's WIDTH, so it is at its meanest
           * right at the point the overlay begins. Below `xl` nothing is
           * competing for the space and the record can have it.
           */
          'size-24 sm:size-28 lg:size-32 xl:size-28 2xl:size-36',
          /*
           * Focus has to be visible. The disc has always been a real button and
           * reachable by keyboard, but it showed nothing on focus, so anyone
           * driving the page from the keyboard could not tell they were on it.
           */
          'outline-none focus-visible:ring-2 focus-visible:ring-site-accent focus-visible:ring-offset-2 focus-visible:ring-offset-site-bg',
          broken
            ? 'cursor-not-allowed opacity-40'
            : /* Was `hover:opacity-95` — a 5% opacity change, which is not
                 feedback anyone can see. The lift is `motion-safe:` because the
                 reduced-motion rule in globals.css governs the spin, not this. */
              'hover:opacity-100 motion-safe:hover:scale-[1.04] motion-safe:active:scale-[0.98] motion-safe:transition-transform',
        )}
      >
        {/*
         * NO PLAY TRIANGLE OVER THE DISC.
         *
         * One was tried — a white triangle on a dark badge, centred, fading out
         * once the track ran — and it was rejected on sight: it covered the
         * label art and turned a record into a generic video thumbnail. The
         * artwork is the point of this hero.
         *
         * What marks it as a control instead: the caption below spelling out
         * "Play the song", the pointer cursor, the hover lift above, and the
         * focus ring for anyone on a keyboard. That is enough without painting
         * over the disc.
         */}
        <VinylDisc playing={playing} />
      </button>

      {/*
       * State in words as well as motion. This is the only cue left for anyone
       * browsing with reduced motion, and it makes the disc legible as a control
       * before the first click for everyone else.
       */}
      <p className="t-label text-center" aria-hidden="true">
        {broken ? 'Song unavailable' : playing ? 'Now playing' : 'Play the song'}
      </p>

      {/* `loop`: the track repeats until the visitor stops it or scrolls away. */}
      <audio ref={audioRef} src={src} loop preload="none" />
    </div>
  );
}
