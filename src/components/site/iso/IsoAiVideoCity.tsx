import {
  Cylinder,
  Diamonds,
  GroundRing,
  GuideLine,
  IsoBox,
  IsoScene,
  Panel,
  Platform,
  Rings,
  RoutingLines,
  Shadows,
  sortByDepth,
} from './IsoKit';
import type { Volume } from './IsoKit';

/**
 * AI Video Production — VERTICAL.
 *
 * The other three spread across their platforms; this one climbs. A narrow
 * plinth, and a tower of generated frames tall enough to break above everything
 * else, so the silhouette is a column rather than a mound. That is what
 * separates it at a glance from the AI Audio panel beside it, which shares its
 * core-and-network language but is laid out as a flat ring.
 *
 * NOTE: no brief was supplied for this panel — the message meant for it repeated
 * the Video Production text. The content is composed from the vocabulary the
 * other three establish, and is cheap to rebuild from the real brief.
 */
const CORE = { x: 3.5, y: 3.4, w: 1.3, d: 1.3, h: 1.9 };

const NODES = [
  { x: 2.1, y: 5.3 },
  { x: 5.6, y: 4.9 },
  { x: 5.2, y: 2.1 },
];

const VOLUMES: Volume[] = [
  { ...CORE, top: 'accent', mark: 'play' },

  ...NODES.map((node) => ({
    x: node.x,
    y: node.y,
    w: 0.5,
    d: 0.5,
    h: 0.5,
    top: 'slate' as const,
  })),

  // The render stack: identical slabs piling up, output waiting to be taken.
  { x: 5.6, y: 5.9, w: 0.8, d: 0.8, h: 0.3, top: 'slate' },
  { x: 5.6, y: 5.9, z: 0.34, w: 0.8, d: 0.8, h: 0.3, top: 'slate' },
  { x: 5.6, y: 5.9, z: 0.68, w: 0.8, d: 0.8, h: 0.3, top: 'accent' },

  // One low desk, and a mast holding the right edge.
  { x: 1.6, y: 1.6, w: 1.5, d: 0.8, h: 0.42, top: 'slate', mark: 'wheels' },
  { x: 6.0, y: 3.2, w: 0.3, d: 0.3, h: 2.6, top: 'none' },
];

const ORDERED = sortByDepth(VOLUMES);

/**
 * The tower of generated frames — the panel's whole idea, so it is drawn big
 * and tall enough to break the skyline. Each holds dim and flashes to full in
 * turn, so the column reads as being produced rather than merely stacked.
 */
const FRAMES = [
  { z: 2.5, delay: 0 },
  { z: 3.9, delay: 700 },
  { z: 5.3, delay: 1400 },
];

export function IsoAiVideoCity({ className }: { className?: string }) {
  const id = 'iso-ai-video';
  const coreTop = { x: CORE.x + CORE.w / 2, y: CORE.y + CORE.d / 2, z: CORE.h };

  return (
    <IsoScene id={id} className={className}>
      {/* A narrow plinth rather than a full slab — the scene is a column. */}
      <Platform w={5.6} d={5.4} x0={1.2} y0={1.2} />
      <Shadows volumes={VOLUMES} />

      <RoutingLines
        legs={NODES.map((node, i) => ({
          from: { x: CORE.x + CORE.w / 2, y: CORE.y + CORE.d / 2, z: 0.8 },
          to: { x: node.x + 0.25, y: node.y + 0.25, z: 0.5 },
          lift: 0,
          accent: i % 2 === 0,
          delay: i * 500,
        }))}
        nodes={NODES.map((node) => ({ x: node.x + 0.25, y: node.y + 0.25, z: 0.5 }))}
      />

      {ORDERED.map((volume, i) => (
        <IsoBox key={i} volume={volume} id={id} />
      ))}

      <Rings disc={{ ...coreTop, r: 0.68 }} delays={[0, 1500]} />

      {/* The tower, rising straight out of the core. */}
      {FRAMES.map((frame) => (
        <Panel
          key={frame.z}
          id={id}
          box={{ x: CORE.x - 0.2, y: CORE.y + 0.5, z: frame.z, w: 1.7, d: 0.05, h: 1.3 }}
          fill="accent"
          className="animate-isoBlink"
          style={{ animationDelay: `${frame.delay}ms` }}
        />
      ))}
      <GuideLine x={CORE.x + 0.75} y={CORE.y + 0.55} z={6.6} />

      {/* One finished screen off to the side, for contrast with the tower. */}
      <Panel
        box={{ x: 5.4, y: 4.0, z: 1.1, w: 1.1, d: 0.05, h: 0.85 }}
        id={id}
        className="animate-isoFloatSlow"
      />

      <Cylinder disc={{ x: 2.6, y: 5.5, r: 0.5 }} height={0.35} hollow />
      <GroundRing x={CORE.x + 0.65} y={CORE.y + 0.65} r={1.6} />

      {/* Shots not yet rendered. */}
      {[
        { x: 2.4, y: 2.2, z: 2.7, delay: 0 },
        { x: 5.4, y: 6.1, z: 3.2, delay: 1600 },
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
          { x: 6.2, y: 1.6, z: 3.6, size: 5, delay: 0, hollow: true },
          { x: 1.8, y: 3.4, z: 4.6, size: 5, delay: 1300 },
        ]}
      />
    </IsoScene>
  );
}

export default IsoAiVideoCity;
