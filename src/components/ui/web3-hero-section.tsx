import { cn } from '@/lib/utils';

/**
 * The raked-grid hero backdrop.
 *
 * Adapted from the "web3 hero section" component. What was taken is the visual
 * idea: a saturated gradient seen through a grid tilted away from the viewer,
 * with the whole thing masked so it dissolves at every edge instead of ending
 * at a hard line.
 *
 * What was deliberately NOT taken is the rest of that component — its heading,
 * paragraph, "Try Molibra" button and row of invented partner logos. Those are
 * someone else's marketing copy; the pages here already have their own words,
 * and this sits behind them rather than replacing them.
 *
 * Three changes were needed to make it belong to this site:
 *
 *   - Palette. The original ran orange → red → BLUE, which is nowhere in the
 *     Rejoice range. It now runs from the ember accent through red into
 *     `site-night`, the deep navy already used for the hero clip's sky.
 *   - Opacity. 90% at full strength is a background that competes with the
 *     type in front of it. This defaults to 30% and is overridable.
 *   - The keyframes moved to `tailwind.config.ts`. The original injected a
 *     `<style>` tag from inside the component, which re-emits the same rules
 *     for every instance on the page and sidesteps the global
 *     `prefers-reduced-motion` rule in `globals.css`. As a Tailwind animation
 *     it is defined once and stops for anyone who asks for less motion.
 */
/**
 * The grid's band mask: two gradients intersected. Vertical fades the band in
 * above the horizon and out before the bottom edge; horizontal pulls it off both
 * sides, so the raked plane never meets an edge of the section.
 */
const GRID_MASK = [
  'linear-gradient(to bottom, transparent 58%, black 72%, black 90%, transparent 100%)',
  'linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%)',
].join(', ');

export function PerspectiveGridHero({
  className,
  opacity = 0.6,
  gridOffset = 63,
}: {
  className?: string;
  /** Strength of the colour wash behind the grid. */
  opacity?: number;
  /**
   * How far down the raked plane is pushed, as a percentage of the container's
   * own height. Must be tuned PER PLACEMENT: because it is a percentage of the
   * element, the same value shifts fewer absolute pixels in a shorter box, so a
   * compact header needs a larger number than a tall hero to clear its copy.
   */
  gridOffset?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {/*
        The elliptical colour wash — rendered only when asked for.

        `opacity={0}` skips it entirely rather than drawing a transparent layer.
        The page heroes now take their colour from `bg-heroFade`, a top-anchored
        linear fade, and a centre-anchored ellipse laid over that fights it
        rather than adding to it. The wash is kept for any placement that wants
        the glow instead.
      */}
      {opacity > 0 ? (
        <div
          className="absolute inset-0"
          style={{
            /*
             * A single radial fade, replacing the original's four intersected
             * linear gradients.
             *
             * The original masks were built for a full-screen hero: they keep the
             * artwork OPAQUE at the left and right edges and punch a transparent
             * hole through the middle, so the colour reads as two side panels
             * framing the centred copy. Dropped into a short header box that
             * inverted read was the whole problem — the panels met the box edge
             * and drew a visible rectangle behind the heading.
             *
             * An ellipse anchored at the centre does what the effect actually
             * needs here: brightest where the type sits, falling to nothing well
             * before any edge, so there is no boundary to see on any side.
             */
            maskImage:
              'radial-gradient(ellipse 62% 58% at 50% 45%, black 0%, black 30%, transparent 70%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 62% 58% at 50% 45%, black 0%, black 30%, transparent 70%)',
          }}
        >
          <div
            className="absolute inset-0 bg-gradient-to-r from-site-accentSoft via-site-accent to-site-night"
            style={{ opacity }}
          />
        </div>
      ) : null}

      {/*
        The grid carries its OWN mask, and must not share the wash's.
        
        They want opposite things. The wash's ellipse is centred high, where the
        glow belongs. The grid is pushed low by `gridOffset` to clear the body
        copy — straight into the part of that ellipse which is fading out. Down
        the centre line the shared mask left the horizon at 0.46 alpha, 85% depth
        at 0.03 and everything below at 0, so 0.22 lines rendered at roughly
        0.055 and read as nothing at all.

        A band mask instead: fades in above the horizon, out before the bottom
        edge, and off at both sides. A single radial cannot do this — one large
        enough to cover the band is still opaque where it meets the bottom of the
        section, which cuts a hard line across it.
      */}
      {/*
        Not drawn on a phone. `gridOffset` is a percentage of element height,
        and on a narrow screen the same copy wraps to enough lines to fill
        almost the whole hero — so every band position either sits inside the
        text (measured -42 to -76px overlap, the 2.96:1 failure again) or falls
        outside the section. A raked floor also needs width to read as one. The
        wash and the grain carry the treatment on mobile instead.
      */}
      <div
        className="absolute inset-0 hidden md:block"
        style={{
          maskImage: GRID_MASK,
          WebkitMaskImage: GRID_MASK,
          maskComposite: 'intersect',
          WebkitMaskComposite: 'source-in',
        }}
      >
        <div className="absolute inset-0" style={{ perspective: '1000px' }}>
          <div
            className="size-full animate-gridRun"
            style={{
              backgroundImage: `repeating-linear-gradient(to bottom, rgba(255,255,255,0.22), rgba(255,255,255,0.22) 1px, transparent 1px, transparent 50px),
                                repeating-linear-gradient(to right, rgba(255,255,255,0.22), rgba(255,255,255,0.22) 1px, transparent 1px, transparent 50px)`,
              /*
               * Rake the plane away from the viewer and pin it to the bottom,
               * so the cells widen as they approach — the floor-stretching-to-
               * the-horizon read. Without `transformOrigin: bottom` the plane
               * pivots about its middle and the horizon lands mid-section.
               *
               * The 63% offset is a CONTRAST constraint, not a taste one. At
               * the original 20% the visible band ran straight through the
               * body copy, and the lines (white at 0.22) lifted the local
               * background enough to drop text to 2.96:1 — under AA, and under
               * even the 3:1 large-text floor. Dimming the lines could not
               * recover it: 0.10 alpha still measured only 4.16:1. Moving the
               * band below the text restores 5.49:1 with the grid intact.
               *
               * Getting there took measuring, not arithmetic: perspective
               * compresses the far end, so each extra percent moves the
               * horizon less than the last. 52% still grazed the final line of
               * copy by 35px and 58% by 11px; 63% clears it by 11px.
               */
              transform: `rotateX(60deg) translateY(${gridOffset}%)`,
              transformOrigin: 'bottom',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default PerspectiveGridHero;
