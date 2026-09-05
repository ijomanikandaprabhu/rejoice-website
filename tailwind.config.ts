import type { Config } from 'tailwindcss';

/**
 * Two design systems, deliberately separate.
 *
 *   `site`  — the public website. Dark editorial, ember-orange accent, glossy
 *             cards, pill buttons. Set in Inter Tight.
 *
 *   `panel` — the admin portal. Near-black panel layout, lime accent used
 *             sparingly, violet behind it as the secondary. Set in Manrope.
 *
 * The admin also consumes shadcn's token set, mapped to the panel palette in
 * globals.css and scoped to `.admin-theme` so the two never collide.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        /* ---- Public website ---- */
        site: {
          bg: '#000000',
          surface: '#1E1B1D',
          /* One step above surface, for insets and hover states. */
          raised: '#252123',
          accent: '#FF6D29',
          accentSoft: '#FF8A52',
          secondary: '#453027',
          /* Deep navy matching the hero clip's night sky. */
          night: '#041A29',
          muted: '#BABABA',
          fg: '#FFFFFF',
        },

        /* ---- Admin portal ---- */
        panel: {
          bg: '#0B0B0C',
          DEFAULT: '#151515',
          alt: '#1C1C1D',
          accent: '#D6FF3F',
          /*
           * The second colour, and the rule for choosing between the two:
           * LIME is the primary action and the peak value — the one thing on a
           * screen worth looking at first. VIOLET is the runner-up: a secondary
           * button, a state badge, second place in a chart.
           *
           * A FILL, NEVER TEXT. Measured against the panel backgrounds it comes
           * to 3.0-3.5:1, which is fine for a bar or a chip (3:1) and below the
           * 4.5:1 small text needs. White on it is 5.61:1, so every use paints
           * it behind `secondary-fg` or draws it as a shape.
           */
          secondary: '#683FFF',
          'secondary-fg': '#FFFFFF',
          muted: '#9A9A9A',
          fg: '#F4F4F2',
          negative: '#FF6B5E',
          /*
           * Classification tints, for badges saying what KIND of video a row
           * is. Deliberately not `accent` or `negative`: lime already means
           * "showing on the website" and coral means "something failed", so
           * reusing either would read as status rather than category.
           */
          short: '#5EC8FF',
          ai: '#B79BFF',
        },

        /* shadcn tokens for the admin, driven by CSS variables. */
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: 'hsl(var(--destructive))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },

      fontFamily: {
        sans: ['var(--font-site)', 'Inter Tight', 'system-ui', 'sans-serif'],
        admin: ['var(--font-admin)', 'Manrope', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        /* Public type scale, exactly as specified. */
        label: ['0.75rem', { lineHeight: '1.2', letterSpacing: '0.08em', fontWeight: '500' }],
        body: ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        h3: ['1.375rem', { lineHeight: '1.35', fontWeight: '500' }],
        /*
         * Headings are LIGHT, and that is the site's voice rather than an
         * oversight.
         *
         * Weight descends with hierarchy — h1 300, h2 400 — so a big heading
         * reads as display type rather than as shouting. The uppercase,
         * wide-tracked titles on Services and About stay heavy on purpose:
         * those are labels, a second voice, and the weight is what makes them
         * work.
         */
        h2: ['2.25rem', { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '400' }],
        h1: ['3.25rem', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '300' }],
      },

      borderRadius: {
        /* Corner scale: inputs, small elements, cards, hero panels. */
        input: '8px',
        sm2: '16px',
        card: '20px',
        hero: '28px',
        pill: '999px',
        /* Admin panels. */
        panel: '20px',
        /* shadcn (admin) keeps its own variable-driven scale. */
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      boxShadow: {
        /* Deep drop shadow under glossy cards. */
        gloss: '0 24px 48px -12px rgba(0,0,0,0.75), 0 2px 8px rgba(0,0,0,0.4)',
        glossHover: '0 32px 64px -12px rgba(0,0,0,0.85), 0 4px 12px rgba(0,0,0,0.5)',
        ember: '0 12px 32px -8px rgba(255,109,41,0.35)',
        panel: '0 12px 32px -16px rgba(0,0,0,0.9)',
      },

      backgroundImage: {
        /* Radial ember, anchored top-right, orange falling to near-black. */
        ember:
          'radial-gradient(120% 100% at 88% 0%, rgba(255,109,41,0.55) 0%, rgba(255,109,41,0.18) 28%, rgba(69,48,39,0.30) 52%, rgba(0,0,0,0) 78%)',
        emberSoft:
          'radial-gradient(100% 120% at 92% 0%, rgba(255,109,41,0.30) 0%, rgba(69,48,39,0.20) 40%, rgba(0,0,0,0) 72%)',
        /*
         * The page heroes: a straight vertical fade, ember at the top running
         * down into black.
         *
         * Five stops rather than two on purpose. A plain two-stop fade spends
         * too much of its length in the bright half, which pushes the hero copy
         * into a band where it cannot be read — muted body text measures
         * 2.32:1 at the very top and only reaches AA past about 25% depth.
         * These stops front-load the falloff so the copy always sits in the
         * dark half.
         */
        heroFade:
          'linear-gradient(180deg, #C4551F 0%, #7D3A1A 22%, #3A1E12 50%, #150C08 75%, #000000 100%)',
        /* Diagonal sheen swept across a card face. */
        sheen:
          'linear-gradient(115deg, rgba(255,255,255,0) 28%, rgba(255,255,255,0.10) 44%, rgba(255,255,255,0.02) 56%, rgba(255,255,255,0) 70%)',

        /*
         * Film grain. Generated by SVG fractal noise rather than shipped as an
         * image, so it costs no request and stays sharp at any density.
         * `stitchTiles` makes the pattern tile seamlessly when it repeats.
         */
        grain:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E\")",
      },

      keyframes: {
        beamBreathe: {
          /*
           * Opacity only, and barely.
           *
           * This now covers the whole section rather than a narrow column: a
           * large field pulsing is far more noticeable, and scaling one would
           * drag its edges into view. 0.94 is enough to feel alive behind a
           * heading someone is reading.
           */
          '0%, 100%': { opacity: '0.94' },
          '50%': { opacity: '1' },
        },
        riseIn: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'none' },
        },
        emberDrift: {
          '0%, 100%': { opacity: '0.85', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        spinRecord: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        /*
         * The perspective hero grid, travelling toward the viewer.
         *
         * The distance MUST be a whole multiple of the 50px cell, or the tile
         * jumps when the loop restarts. 100px is two cells.
         */
        gridRun: {
          from: { backgroundPosition: '0 0' },
          to: { backgroundPosition: '-100px -100px' },
        },
        /*
         * Marquee. The track holds the same list twice, so travelling exactly
         * -50% lands the second copy where the first started — the loop is
         * seamless only because of that pairing. Duration is set per-instance
         * from the item count (9s each) so speed stays constant whatever the
         * row length — the value below is only a fallback.
         */
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },

        /* ---- Isometric service panels ---------------------------------- */

        /** The whole scene breathes, so a static drawing never sits dead. */
        isoFloat: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        /** Floaters, at a different amplitude so they drift out of phase. */
        isoFloatSlow: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        /** Level-meter blocks. Staggered per block, which is what reads as levels. */
        isoMeter: {
          '0%, 100%': { transform: 'translateY(0)' },
          '45%': { transform: 'translateY(-9px)' },
        },
        /** Signal travelling along a routing line. */
        isoDash: {
          from: { strokeDashoffset: '40' },
          to: { strokeDashoffset: '0' },
        },
        /** Rings leaving the speaker cone. */
        isoPing: {
          '0%': { transform: 'scale(1)', opacity: '0.85' },
          '100%': { transform: 'scale(2.6)', opacity: '0' },
        },
        /** Wireframe volumes drifting up and out, as if being generated. */
        isoRise: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '35%, 65%': { opacity: '0.75' },
          '100%': { transform: 'translateY(-26px)', opacity: '0' },
        },
        /** Generated frames appearing one after another. */
        isoBlink: {
          '0%, 70%, 100%': { opacity: '0.25' },
          '20%, 50%': { opacity: '1' },
        },
        /** Terminal dots on the routing lines. */
        isoPulse: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '1' },
        },
      },

      animation: {
        riseIn: 'riseIn 600ms cubic-bezier(0.22, 1, 0.36, 1) both',
        emberDrift: 'emberDrift 18s ease-in-out infinite',
        /*
         * Slow on purpose. The original ran this in 10s, which under a 60deg
         * rake reads as rushing traffic behind a heading someone is reading.
         */
        gridRun: 'gridRun 26s linear infinite',
        /*
         * The Music hero's light shaft, breathing.
         *
         * 14s and barely-there: this sits behind a heading someone is reading,
         * so anything faster or wider reads as a flicker rather than as light.
         */
        beamBreathe: 'beamBreathe 14s ease-in-out infinite',
        /*
         * 6s, well off the 1.8s of a real 33⅓rpm LP. The eye judges angular
         * speed, so at hero size the authentic rate reads as a fidget spinner;
         * this is slow enough to sit calmly next to the drifting hero film
         * while the label mark still makes the rotation obvious.
         */
        spinRecord: 'spinRecord 6s linear infinite',
        marquee: 'marquee 40s linear infinite',

        /*
         * Deliberately slow and long-period: these panels sit beside body copy
         * that people are reading, so the motion has to be noticeable when
         * looked at and ignorable when not. All CSS, so the global
         * `prefers-reduced-motion` rule switches every one of them off.
         */
        isoFloat: 'isoFloat 9s ease-in-out infinite',
        isoFloatSlow: 'isoFloatSlow 7s ease-in-out infinite',
        isoMeter: 'isoMeter 1.6s ease-in-out infinite',
        isoDash: 'isoDash 2.4s linear infinite',
        isoPing: 'isoPing 2.8s ease-out infinite',
        isoPulse: 'isoPulse 2.2s ease-in-out infinite',
        isoRise: 'isoRise 5s ease-in-out infinite',
        isoBlink: 'isoBlink 3.2s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
