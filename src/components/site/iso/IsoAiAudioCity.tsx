import {
  Cylinder,
  Diamonds,
  GroundRing,
  GuideLine,
  IsoBox,
  IsoScene,
  Panel,
  Rings,
  RoutingLines,
  Shadows,
  sortByDepth,
} from './IsoKit';
import type { Volume } from './IsoKit';

/**
 * AI Audio Production — RADIAL, and standing on nothing.
 *
 * Two things set this panel apart from the other three at a glance:
 *
 *   1. NO PLATFORM. It sits straight on the grid plane. Losing the slab changes
 *      the silhouette more than any rearrangement of blocks could, and it suits
 *      a scene that is about a network rather than a place.
 *   2. RADIAL COMPOSITION. One core in the middle, six nodes on an actual ring
 *      around it, pulses running outward along the spokes. The other panels are
 *      skylines and stacks; this one is a hub.
 *
 * Orange is rationed to the core and the hovering cube, so it is also the
 * coolest-looking of the four apart from Video.
 */
const CENTRE = { x: 4.2, y: 4.0 };
const CORE = { x: CENTRE.x - 0.6, y: CENTRE.y - 0.6, w: 1.2, d: 1.2, h: 2.3 };
const RADIUS = 3.6;

/** Six nodes on a ring. Computed, so they sit on a true circle. */
const NODES = Array.from({ length: 6 }, (_, i) => {
  const angle = (i / 6) * Math.PI * 2 + Math.PI / 12;
  return {
    x: CENTRE.x + Math.cos(angle) * RADIUS,
    y: CENTRE.y + Math.sin(angle) * RADIUS,
  };
});

const VOLUMES: Volume[] = [
  { ...CORE, top: 'accent', mark: 'spark' },

  // The ring of nodes: identical cubes, because they are instances of one
  // thing rather than a skyline of different buildings.
  ...NODES.map((node) => ({
    x: node.x - 0.25,
    y: node.y - 0.25,
    w: 0.5,
    d: 0.5,
    h: 0.5,
    top: 'slate' as const,
  })),

  // One microphone mast, so the panel still says "audio".
  { x: 1.1, y: 1.1, w: 0.28, d: 0.28, h: 1.9, top: 'none' },
  { x: 0.95, y: 0.95, w: 0.58, d: 0.58, h: 0.42, z: 1.9, top: 'slate' },
];

const ORDERED = sortByDepth(VOLUMES);

export function IsoAiAudioCity({ className }: { className?: string }) {
  const id = 'iso-ai-audio';
  const coreTop = { x: CENTRE.x, y: CENTRE.y, z: CORE.h };

  return (
    <IsoScene id={id} className={className}>
      {/* No Platform. See the note above — this is the deliberate difference. */}
      <Shadows volumes={VOLUMES} />

      {/* The ring the nodes stand on, drawn as a dashed orbit. */}
      <GroundRing x={CENTRE.x} y={CENTRE.y} r={RADIUS} />

      <RoutingLines
        legs={NODES.map((node, i) => ({
          from: { x: CENTRE.x, y: CENTRE.y, z: 1.1 },
          to: { x: node.x, y: node.y, z: 0.5 },
          lift: 0,
          accent: i % 2 === 0,
          delay: i * 320,
        }))}
        nodes={NODES.map((node) => ({ x: node.x, y: node.y, z: 0.5 }))}
      />

      {ORDERED.map((volume, i) => (
        <IsoBox key={i} volume={volume} id={id} />
      ))}

      {/* The cube hovering over the core — the thing being made. */}
      <g className="animate-isoFloatSlow">
        <IsoBox
          id={id}
          volume={{
            x: CENTRE.x - 0.28,
            y: CENTRE.y - 0.28,
            z: CORE.h + 0.7,
            w: 0.56,
            d: 0.56,
            h: 0.56,
            top: 'accent',
          }}
        />
      </g>
      <GuideLine x={CENTRE.x} y={CENTRE.y} z={CORE.h + 1.3} />

      <Rings disc={{ ...coreTop, r: 0.7 }} delays={[0, 1500]} />

      <Cylinder disc={{ x: 7.3, y: 6.4, r: 0.55 }} height={0.5} hollow />

      {/* Waveform ribbons, off to one side rather than in a row across the
          middle — the ring already owns the centre. */}
      {[0, 1, 2, 3].map((i) => (
        <Panel
          key={i}
          id={id}
          box={{ x: 6.8 + i * 0.3, y: 0.9, w: 0.22, d: 0.05, h: [0.45, 0.9, 0.6, 1.05][i] }}
          fill="none"
          className="animate-isoMeter"
          style={{ animationDelay: `${i * 190}ms` }}
        />
      ))}

      {/* Wireframe cubes rising off the ring: not solid yet. */}
      {[
        { x: 2.2, y: 6.3, z: 2.6, delay: 0 },
        { x: 6.4, y: 2.2, z: 3.1, delay: 1700 },
      ].map((cube) => (
        <g
          key={`${cube.x}-${cube.y}`}
          className="animate-isoRise"
          style={{ animationDelay: `${cube.delay}ms` }}
        >
          <IsoBox
            id={id}
            volume={{
              x: cube.x,
              y: cube.y,
              z: cube.z,
              w: 0.45,
              d: 0.45,
              h: 0.45,
              top: 'none',
              wire: true,
            }}
          />
        </g>
      ))}

      <Diamonds
        at={[
          { x: 1.6, y: 6.6, z: 3.4, size: 5, delay: 0, hollow: true },
          { x: 7.2, y: 3.4, z: 3.8, size: 5, delay: 1400, hollow: true },
        ]}
      />
    </IsoScene>
  );
}

export default IsoAiAudioCity;
