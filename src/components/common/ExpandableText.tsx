'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A block of text clipped to a few lines, with a "…more" control.
 *
 * Video descriptions run long — over 1,300px of text on some of this
 * catalogue's videos — which buried everything below them. This shows the
 * opening lines and lets the reader ask for the rest.
 *
 * The full text is always in the DOM; collapsing is purely visual, done with
 * `line-clamp`. Nothing is removed, so search engines still index the whole
 * description and the links inside it stay real links in both states.
 */
export function ExpandableText({
  children,
  lines = 4,
  className,
}: {
  children: React.ReactNode;
  /** How many lines to show while collapsed. */
  lines?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /*
   * Only offer the control when the text is ACTUALLY cut off.
   *
   * A two-line description with a "…more" button underneath that reveals
   * nothing is worse than no button, so the decision is measured rather than
   * guessed from character count — the same string wraps to a different number
   * of lines at different widths.
   *
   * Re-measured on resize for that reason: a description that fits on a wide
   * screen may well be clipped on a phone.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      // While expanded the element is its full height, so there is nothing to
      // compare — leave the last known answer alone.
      if (expanded) return;
      setClipped(el.scrollHeight > el.clientHeight + 1);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, children]);

  return (
    <div className={className}>
      <div
        ref={ref}
        // `-webkit-line-clamp` is applied inline rather than through a Tailwind
        // class so the line count stays a prop. It coexists with the
        // `white-space: pre-line` that preserves the description's line breaks
        // and the `overflow-wrap: anywhere` that keeps long URLs from pushing
        // the page sideways — both verified on this page.
        style={
          expanded
            ? undefined
            : {
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: lines,
                overflow: 'hidden',
              }
        }
      >
        {children}
      </div>

      {clipped ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-2 text-[0.9375rem] font-medium text-site-fg transition-colors hover:text-site-accent"
        >
          {expanded ? 'Show less' : '…more'}
        </button>
      ) : null}
    </div>
  );
}
