'use client';

/*
 * The same boundary the rest of the public site uses.
 *
 * Re-exported rather than copied: a route group does NOT inherit its sibling's
 * `error.tsx`, so without this file a throw on one of these pages would fall
 * through to Next's unbranded default screen with no way back.
 */
export { default } from '../(public)/error';
