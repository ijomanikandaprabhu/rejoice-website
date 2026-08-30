import { describe, expect, it } from 'vitest';

import { boxFaces, discGeometry, project, shadowPoly, UNIT } from '@/components/site/iso/isoMath';

/**
 * The projection every service panel is drawn from.
 *
 * Worth testing rather than eyeballing: a small error here is invisible in one
 * shape and glaring across a whole scene, because every volume inherits it.
 */
describe('isometric projection', () => {
  it('places the origin at the origin', () => {
    expect(project(0, 0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('sends the x and y axes down the screen in mirrored directions', () => {
    const alongX = project(1, 0);
    const alongY = project(0, 1);

    // Equal and opposite horizontally…
    expect(alongX.x).toBeCloseTo(-alongY.x, 10);
    // …and identical vertically. That symmetry is what makes it isometric
    // rather than a squashed 2:1 projection.
    expect(alongX.y).toBeCloseTo(alongY.y, 10);
    expect(alongX.y).toBeCloseTo(UNIT / 2, 10);
  });

  it('moves height straight up', () => {
    const ground = project(3, 2, 0);
    const raised = project(3, 2, 1);

    expect(raised.x).toBeCloseTo(ground.x, 10);
    expect(ground.y - raised.y).toBeCloseTo(UNIT, 10);
  });

  it('keeps parallel lines parallel', () => {
    // Two segments that are parallel in world space must stay parallel on
    // screen — the defining property of an axonometric projection.
    const slope = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      (b.y - a.y) / (b.x - a.x);

    const first = slope(project(0, 0), project(2, 0));
    const second = slope(project(0, 5), project(2, 5));

    expect(first).toBeCloseTo(second, 10);
  });
});

describe('discGeometry', () => {
  it('matches the derived semi-axes of the projected ellipse', () => {
    const { rx, ry } = discGeometry({ x: 0, y: 0, r: 2 });

    // rx = r·cos30·√2, ry = r·√2/2 — see the derivation in isoMath.ts.
    expect(rx).toBeCloseTo(2 * Math.cos(Math.PI / 6) * Math.SQRT2 * UNIT, 10);
    expect(ry).toBeCloseTo(((2 * Math.SQRT2) / 2) * UNIT, 10);
  });

  it('is wider than it is tall, as a ground-plane circle must be', () => {
    const { rx, ry } = discGeometry({ x: 1, y: 1, r: 1 });
    expect(rx).toBeGreaterThan(ry);
  });

  it('lifts the centre by the height without moving it sideways', () => {
    const ground = discGeometry({ x: 2, y: 2, r: 1 });
    const raised = discGeometry({ x: 2, y: 2, z: 1.5, r: 1 });

    expect(raised.centre.x).toBeCloseTo(ground.centre.x, 10);
    expect(ground.centre.y - raised.centre.y).toBeCloseTo(1.5 * UNIT, 10);
  });
});

describe('boxFaces', () => {
  const faces = boxFaces({ x: 0, y: 0, w: 1, d: 1, h: 1 });

  it('returns four points for each visible face', () => {
    for (const face of [faces.top, faces.left, faces.right]) {
      expect(face.split(' ')).toHaveLength(4);
    }
  });

  it('puts the top face above the side faces', () => {
    const lowestY = (points: string) =>
      Math.max(...points.split(' ').map((p) => Number(p.split(',')[1])));

    // Smaller y is higher on screen; the top face's lowest point is still above
    // the sides' lowest points.
    expect(lowestY(faces.top)).toBeLessThan(lowestY(faces.left));
    expect(lowestY(faces.top)).toBeLessThan(lowestY(faces.right));
  });
});

describe('shadowPoly', () => {
  it('grows with the height of the volume that casts it', () => {
    const spread = (points: string) => {
      const xs = points.split(' ').map((p) => Number(p.split(',')[0]));
      return Math.max(...xs) - Math.min(...xs);
    };

    const short = shadowPoly({ x: 0, y: 0, w: 1, d: 1, h: 1 });
    const tall = shadowPoly({ x: 0, y: 0, w: 1, d: 1, h: 3 });

    expect(spread(tall)).toBeGreaterThan(spread(short));
  });
});
