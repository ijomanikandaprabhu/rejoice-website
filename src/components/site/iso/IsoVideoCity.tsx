import {
  Cylinder,
  Diamonds,
  GroundRing,
  GuideLine,
  IsoBox,
  IsoScene,
  Panel,
  Platform,
  RoutingLines,
  Shadows,
  sortByDepth,
} from './IsoKit';
import type { Volume } from './IsoKit';

/**
 * Video Production — a SET, not a city.
 *
 * Deliberately the sparsest of the four: low, wide, with the floor left visibly
 * empty and two big screens dominating everything. The Audio panel next to it is
 * a packed vertical skyline, so if this one were also a mound of blocks the two
 * would read as the same drawing at a glance — which is exactly what the first
 * pass did.
 *
 * Nine volumes. Most are slate; the only orange is the two lights and the play
 * block, so it is also the coolest panel of the set.
 */
const VOLUMES: Volume[] = [
  // One camera tower, with its lens below.
  { x: 0.5, y: 6.4, w: 0.45, d: 0.45, h: 1.9, top: 'none' },
  { x: 0.25, y: 6.15, w: 0.95, d: 0.95, h: 0.65, z: 1.9, top: 'slate' },

  // Two light stands. Tall and thin, holding the big softboxes.
  { x: 7.4, y: 6.9, w: 0.26, d: 0.26, h: 2.1, top: 'none' },
  { x: 8.4, y: 2.2, w: 0.26, d: 0.26, h: 1.8, top: 'none' },

  // The floor: one long low block carrying the scrubber, and the grading desk.
  { x: 2.6, y: 2.9, w: 3.4, d: 1.3, h: 0.38, top: 'slate', mark: 'scrubber' },
  { x: 2.2, y: 0.7, w: 1.7, d: 0.85, h: 0.42, top: 'slate', mark: 'wheels' },

  // The play block — the one warm object at the front.
  { x: 5.4, y: 0.8, w: 1.15, d: 1.15, h: 0.75, top: 'accent', mark: 'play' },

  // The clapper, in two pieces.
  { x: 0.7, y: 1.4, w: 1.1, d: 0.75, h: 0.26, top: 'slate', mark: 'faders' },
  { x: 0.7, y: 1.4, z: 0.26, w: 1.1, d: 0.2, h: 0.15, top: 'accent' },
];

const ORDERED = sortByDepth(VOLUMES);

export function IsoVideoCity({ className }: { className?: string }) {
  const id = 'iso-video';

  return (
    <IsoScene id={id} className={className}>
      <Platform w={10.4} d={9.4} x0={-0.7} y0={-0.7} />
      <Shadows volumes={VOLUMES} />

      <RoutingLines
        legs={[
          {
            from: { x: 5.9, y: 1.3, z: 0.75 },
            to: { x: 7.53, y: 7.03, z: 2.1 },
            lift: 40,
            accent: true,
          },
        ]}
        nodes={[{ x: 5.9, y: 1.3, z: 0.75 }]}
      />

      {ORDERED.map((volume, i) => (
        <IsoBox key={i} volume={volume} id={id} />
      ))}

      {/* The two softboxes: the biggest orange in the scene, and the reason the
          panel reads as a lit set rather than a skyline. */}
      <Panel box={{ x: 6.7, y: 6.9, z: 1.5, w: 1.7, d: 0.06, h: 1.15 }} id={id} fill="accent" />
      <Panel box={{ x: 7.7, y: 2.2, z: 1.25, w: 1.5, d: 0.06, h: 1.05 }} id={id} fill="accent" />

      {/* Two large screens, floating over the empty floor. */}
      <Panel
        box={{ x: 2.6, y: 5.0, z: 0.9, w: 3.0, d: 0.05, h: 1.5 }}
        id={id}
        className="animate-isoFloatSlow"
      />
      <Panel
        box={{ x: 1.2, y: 3.2, z: 0.8, w: 1.0, d: 0.05, h: 1.5 }}
        id={id}
        className="animate-isoFloatSlow"
        style={{ animationDelay: '1100ms' }}
      />

      <Cylinder disc={{ x: 0.73, y: 6.63, z: 2.55, r: 0.3 }} height={0.2} hollow />

      {/* Dressing: where the big screen hangs, and a mark round the play block. */}
      <GuideLine x={4.1} y={5.5} z={2.4} />
      <GroundRing x={5.98} y={1.38} r={1.15} />

      <Diamonds
        at={[
          { x: 2.4, y: 0.3, z: 2.9, size: 5, delay: 0, hollow: true },
          { x: 8.6, y: 5.2, z: 3.0, size: 6, delay: 1500 },
        ]}
      />
    </IsoScene>
  );
}

export default IsoVideoCity;
