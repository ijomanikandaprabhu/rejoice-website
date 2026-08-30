/**
 * Isometric projection, shared by every scene on the Services page.
 *
 * TRUE isometric, not a fake 2:1 "game" projection: the three axes meet at 120°
 * and parallel lines stay parallel, so nothing converges toward a vanishing
 * point. That is what the illustration briefs ask for, and it is also what makes
 * the shapes composable — a box drawn at one place in the grid is congruent with
 * the same box anywhere else, so scenes can be assembled from a small kit.
 *
 * The world is a right-handed grid: +x runs down-right on screen, +y runs
 * down-left, +z straight up. One world unit is one `UNIT` of screen space.
 */

const COS30 = Math.cos(Math.PI / 6); // 0.8660…
const ROOT2 = Math.SQRT2;

/** Screen pixels per world unit. */
export const UNIT = 26;

export type Point = { x: number; y: number };

/**
 * World → screen.
 *
 * `sx = (x − y)·cos30` and `sy = (x + y)/2 − z`: moving one unit along x and one
 * along y pushes the point the same distance down, in mirrored directions, and
 * height only ever moves a point straight up the screen.
 */
export function project(x: number, y: number, z = 0): Point {
  return {
    x: (x - y) * COS30 * UNIT,
    y: ((x + y) / 2 - z) * UNIT,
  };
}

/** A polygon as an SVG `points` string. */
export function polygon(points: Point[]): string {
  return points.map((p) => `${round(p.x)},${round(p.y)}`).join(' ');
}

function round(n: number) {
  // Two decimals: enough that shapes meet cleanly, short enough to keep the
  // rendered markup readable.
  return Math.round(n * 100) / 100;
}

export type Box = {
  /** Near corner of the footprint. */
  x: number;
  y: number;
  /** Height of the base above the ground plane. */
  z?: number;
  /** Footprint size along x and y, and the height. */
  w: number;
  d: number;
  h: number;
};

export type BoxFaces = {
  top: string;
  /** The face at max x — reads as the right-hand side. */
  right: string;
  /** The face at max y — reads as the left-hand side. */
  left: string;
};

/**
 * The three faces of a box the viewer can see.
 *
 * From this angle exactly three are visible: the top, and the two sides whose
 * normals point toward the camera (+x and +y). The other three are always
 * hidden, so they are never drawn — which is most of why these scenes stay
 * light.
 */
export function boxFaces({ x, y, z = 0, w, d, h }: Box): BoxFaces {
  const top = z + h;

  return {
    top: polygon([
      project(x, y, top),
      project(x + w, y, top),
      project(x + w, y + d, top),
      project(x, y + d, top),
    ]),
    right: polygon([
      project(x + w, y, top),
      project(x + w, y + d, top),
      project(x + w, y + d, z),
      project(x + w, y, z),
    ]),
    left: polygon([
      project(x, y + d, top),
      project(x + w, y + d, top),
      project(x + w, y + d, z),
      project(x, y + d, z),
    ]),
  };
}

/**
 * The flat shadow a box casts down-right: its footprint, sheared away from the
 * light and stretched, drawn on the ground plane.
 */
export function shadowPoly({ x, y, w, d, h }: Box, length = 1.6): string {
  /*
   * The offset is mostly along +x, only slightly along +y.
   *
   * That asymmetry is the whole point: screen-x is `(x − y)·cos30`, so shifting
   * a footprint by the SAME amount along both axes cancels horizontally and the
   * shadow slides straight down instead of down-right. Weighting x more throws
   * it to the right, which is where the brief puts the light.
   */
  const reachX = h * length;
  const reachY = h * length * 0.25;

  // The hull of the footprint and its offset copy.
  return polygon([
    project(x, y, 0),
    project(x + w, y, 0),
    project(x + w + reachX, y + reachY, 0),
    project(x + w + reachX, y + d + reachY, 0),
    project(x + reachX, y + d + reachY, 0),
    project(x, y + d, 0),
  ]);
}

export type Disc = {
  /** Centre of the circle in the ground plane. */
  x: number;
  y: number;
  z?: number;
  r: number;
};

export type DiscGeometry = {
  centre: Point;
  /** Semi-axes of the projected ellipse, in screen pixels. */
  rx: number;
  ry: number;
};

/**
 * A circle lying in the ground plane projects to an ellipse whose axes are
 * aligned with the screen.
 *
 * Substituting `(r·cosθ, r·sinθ)` into `project` gives
 * `sx = r·cos30·√2·cos(θ+45°)` and `sy = (r·√2/2)·sin(θ+45°)` — an axis-aligned
 * ellipse with those two semi-axes. Worth deriving rather than eyeballing: a
 * cylinder whose cap is a guessed ellipse never quite sits on its own base.
 */
export function discGeometry({ x, y, z = 0, r }: Disc): DiscGeometry {
  return {
    centre: project(x, y, z),
    rx: r * COS30 * ROOT2 * UNIT,
    ry: ((r * ROOT2) / 2) * UNIT,
  };
}
