/**
 * Dot positions for the hero record's halftone face.
 *
 * The record is drawn as concentric rings of small dots. Emitting those as
 * individual <circle> elements would be ~800 DOM nodes inside a spinning group,
 * which is real paint cost on a phone — so every dot is instead a subpath of one
 * <path>, built once at module scope. One node, same picture.
 *
 * `stroke-dasharray` on concentric circles looks like the easier trick, but dash
 * phase drifts from ring to ring and the rings visibly beat against each other.
 */

const CX = 100;
const CY = 100;

/** Innermost ring sits just outside the centre label (r=30). */
const RING_MIN = 34;
const RING_MAX = 94;
const RINGS = 13;

/**
 * Dot radius is deliberately constant across rings. The reference art tapers it,
 * but at hero size the outer dots fall below a pixel and the disc goes moth-eaten.
 */
const DOT_R = 1.45;

/** Target arc length between dot centres, in viewBox units. */
const ARC_GAP = 7;

/** One dot as a subpath: move to its left edge, then two half-arcs back around. */
function dot(x: number, y: number, r: number): string {
  const sx = (x - r).toFixed(2);
  const sy = y.toFixed(2);
  return `M${sx},${sy}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
}

export const VINYL_DOTS_PATH: string = (() => {
  const parts: string[] = [];

  for (let i = 0; i < RINGS; i += 1) {
    const radius = RING_MIN + ((RING_MAX - RING_MIN) * i) / (RINGS - 1);

    // Dot count follows circumference, so density stays even across the face
    // instead of bunching up towards the middle.
    const count = Math.max(12, Math.round((2 * Math.PI * radius) / ARC_GAP));

    // Offset every other ring by half a step, otherwise the dots line up into
    // radial spokes and the halftone reads as a star.
    const phase = (i % 2) * (Math.PI / count);

    for (let j = 0; j < count; j += 1) {
      const angle = phase + (j * 2 * Math.PI) / count;
      parts.push(dot(CX + radius * Math.cos(angle), CY + radius * Math.sin(angle), DOT_R));
    }
  }

  return parts.join('');
})();
