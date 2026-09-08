import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier';

/**
 * Flat config, replacing `.eslintrc.json`.
 *
 * Two things forced this at the same time. ESLint 9 no longer reads
 * `.eslintrc.json` by default, and `eslint-config-next@16` requires ESLint 9 —
 * so upgrading Next meant upgrading ESLint meant moving to flat config. And
 * Next 16 removed `next lint` altogether: `npm run lint` used to call it and
 * started failing with "no such directory: ./lint", because the command now
 * reads its first argument as a project path. The script calls `eslint`
 * directly now.
 *
 * `eslint-config-next/core-web-vitals` already exports a flat array in v16, so
 * no `FlatCompat` shim is needed — it spreads straight in.
 *
 * `prettier` stays last. It exists only to switch OFF stylistic rules that
 * would fight the formatter, so anything after it would undo that.
 */
const config = [
  {
    ignores: [
      '.next/**',
      // A nested checkout of this same repo on another branch. Linting it
      // reports every problem twice and resurrects files deleted on this one.
      '.claude/**',
      'node_modules/**',
      'next-env.d.ts',
      'public/maplibre/**',
      'prisma/migrations/**',
    ],
  },
  ...nextCoreWebVitals,
  prettier,

  /*
   * Two rules kept as warnings rather than errors, deliberately and
   * temporarily.
   *
   * `set-state-in-effect` and `refs` arrive with the React 19 hooks plugin.
   * They are good rules, and they flag eleven places in code that predates them
   * by a long way: the shorts feed, the scroll animations, the search debounce.
   * Every one of those is working, and several were hard to get right across
   * engines in the first place.
   *
   * The upgrade they came in with exists to clear a security advisory. Folding
   * an eleven-site refactor of animation and input-timing code into it would
   * multiply the risk and make the change impossible to review — and the review
   * is the only thing standing between this and a broken live site.
   *
   * So they warn: still printed on every run, still impossible to miss, and not
   * blocking a security fix. Worth working through as its own change, where a
   * regression in the shorts player can be traced to the commit that caused it.
   */
  {
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
];

export default config;
