'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

type LetterHoverProps = {
  /** A `\n` splits the text into deliberate lines. */
  text: string;
  /** Element to render as. Defaults to a `div`; the Channels page uses `h1`. */
  as?: 'h1' | 'h2' | 'div';
  className?: string;
};

/** How each letter reacts, by distance from the one under the pointer. */
const FALLOFF = [
  { scale: 1.4, lift: -20, tilt: -15, bright: 1.3, depth: 30 },
  { scale: 1.2, lift: -10, tilt: -8, bright: 1.15, depth: 15 },
  { scale: 1.1, lift: -5, tilt: -4, bright: 1.08, depth: 15 },
] as const;

const REST = { scale: 1, lift: 0, tilt: 0, bright: 1, depth: 0 } as const;

/**
 * Text whose letters lift and swell around the pointer, the neighbours
 * following at a reducing amount.
 *
 * Adapted from the supplied `scale-letter`. Its distance falloff and spring
 * easing are kept; four things had to change:
 *
 *   1. IT WOULD HAVE BEEN INVISIBLE. The original injected `--th-text: #000`
 *      on `:root` and only overrode it under `html.dark`. This site sets no
 *      `dark` class, so every letter would have been black on a black page.
 *      Colour now comes from the site's own tokens.
 *
 *   2. NO INJECTED GLOBAL CSS. It carried a `<style jsx global>` block that
 *      defined `:root` variables from inside a component, leaking theme
 *      variables site-wide. Gone entirely — nothing here needs raw CSS.
 *
 *   3. NOT A FULL-SCREEN PANEL. It was `h-screen` with a white gradient.
 *
 *   4. REAL TEXT, WRAPPED PROPERLY. The original hardcoded an 8-character
 *      string in one non-wrapping row. Real copy is longer, so lines are
 *      explicit and each WORD is a non-wrapping group — letters as bare
 *      inline-blocks would otherwise break mid-word on a narrow screen.
 *
 * `prefers-reduced-motion` needs nothing special: the movement is a CSS
 * transition, and the global rule in globals.css forces
 * `transition-duration: 0.01ms !important`, which beats the inline style.
 */
export function LetterHover({ text, as: Tag = 'div', className }: LetterHoverProps) {
  const [hovered, setHovered] = React.useState(-1);

  /*
   * Letters are indexed ACROSS the whole string, not per line, so the falloff
   * carries over a space and over a line break instead of resetting — which is
   * what makes it read as one continuous surface rather than separate words.
   */
  const lines = React.useMemo(() => {
    let index = 0;
    return text.split('\n').map((line) =>
      line.split(' ').map((word) => ({
        word,
        letters: [...word].map((char) => ({ char, index: index++ })),
        // Consume the space that followed this word.
        spaceIndex: index++,
      })),
    );
  }, [text]);

  const styleFor = (index: number): React.CSSProperties => {
    const distance = hovered >= 0 ? Math.abs(index - hovered) : Infinity;
    const step = FALLOFF[distance] ?? REST;

    return {
      transform: `perspective(1000px) translateY(${step.lift}px) rotateX(${step.tilt}deg) scale(${step.scale}) translateZ(${step.depth}px)`,
      filter: `brightness(${step.bright})`,
      transition: 'transform 400ms cubic-bezier(0.175, 0.885, 0.32, 1.275), color 400ms ease, filter 400ms ease',
      zIndex: distance === 0 ? 10 : distance <= 2 ? 5 : 1,
    };
  };

  return (
    <Tag
      // The sentence, so a screen reader reads it rather than spelling it out.
      aria-label={text.replace(/\n/g, ' ')}
      onMouseLeave={() => setHovered(-1)}
      className={cn(
        'select-none text-center font-bold leading-[1.05] tracking-[-0.02em] text-site-fg',
        'text-[clamp(1.5rem,6.4vw,5.5rem)]',
        className,
      )}
    >
      {lines.map((words, lineIndex) => (
        /*
         * A block row of inline-flex words with REAL space characters between
         * them — not a flex gap. A gap would look identical but leave the
         * heading's text content as "Stories,Worship&Songs", which is what
         * gets copied, indexed and asserted against. Spaces also give the row
         * a natural place to wrap on a narrow screen, never mid-word.
         */
        <span key={lineIndex} className="block" aria-hidden="true">
          {words.map(({ word, letters }, wordIndex) => (
            <React.Fragment key={word + letters[0]?.index}>
              {wordIndex > 0 ? ' ' : null}
              <span className="inline-flex whitespace-nowrap">
                {letters.map(({ char, index }) => (
                  <span
                    key={index}
                    className={cn(
                      'inline-block cursor-default transition-colors',
                      hovered === index ? 'text-site-accent' : undefined,
                    )}
                    style={styleFor(index)}
                    onMouseEnter={() => setHovered(index)}
                  >
                    {char}
                  </span>
                ))}
              </span>
            </React.Fragment>
          ))}
        </span>
      ))}
    </Tag>
  );
}

export default LetterHover;
