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
 * Audio Production — a city of studio forms.
 *
 * The DENSE one: tall, packed, vertical. It is the reference point for "busy"
 * in the set, and carries the most orange — the Video panel beside it is
 * deliberately its opposite, low and mostly empty.
 *
 * Eleven volumes. The panel renders about 440px wide inside the two-column grid
 * and 330px on a phone; past that count the hatching and hairlines stop reading
 * as line work and turn into texture.
 */
const VOLUMES: Volume[] = [
  // Back row — tall slender towers.
  { x: 0.6, y: 5.4, w: 1.1, d: 1.1, h: 5.0, top: 'accent' },
  { x: 1.9, y: 6.2, w: 0.95, d: 0.95, h: 3.4, top: 'slate', mark: 'dots' },

  // The level meter: stepped blocks that bob in sequence. This is the motion
  // that says "audio", so it sits in the middle of the composition.
  { x: 3.4, y: 6.6, w: 0.55, d: 0.9, h: 1.0, top: 'accent', meterDelay: 0 },
  { x: 4.05, y: 6.6, w: 0.55, d: 0.9, h: 1.7, top: 'accent', meterDelay: 160 },
  { x: 4.7, y: 6.6, w: 0.55, d: 0.9, h: 2.4, top: 'accent', meterDelay: 320 },
  { x: 5.35, y: 6.6, w: 0.55, d: 0.9, h: 1.9, top: 'accent', meterDelay: 480 },
  { x: 6.0, y: 6.6, w: 0.55, d: 0.9, h: 1.2, top: 'accent', meterDelay: 640 },

  // Mid ground — a console with fader strips, and a slim pillar.
  { x: 2.6, y: 3.4, w: 2.2, d: 1.4, h: 0.7, top: 'slate', mark: 'faders' },
  { x: 6.4, y: 4.4, w: 0.6, d: 0.6, h: 4.2, top: 'accent' },

  // Front — low cubes flanking the speaker.
  { x: 1.6, y: 1.2, w: 1.2, d: 1.2, h: 0.9, top: 'accent' },
  { x: 6.2, y: 1.4, w: 1.0, d: 1.0, h: 1.4, top: 'slate' },

  // Corner fillers, so the slab does not read as mostly empty ground.
  { x: 7.4, y: 2.8, w: 0.75, d: 0.75, h: 2.8, top: 'accent' },
];

const ORDERED = sortByDepth(VOLUMES);
const SPEAKER = { x: 3.9, y: 2.2, r: 0.85 };
const ARCH = { x: 0.7, y: 1.4, w: 1.5, d: 0.45, h: 1.5, leg: 0.32 };

export function IsoAudioCity({ className }: { className?: string }) {
  const id = 'iso-audio';

  return (
    <IsoScene id={id} className={className}>
      <Platform />
      <Shadows volumes={VOLUMES} />

      <RoutingLines
        legs={[
          {
            from: { x: 1.6, y: 1.8, z: 0.9 },
            to: { x: 4.0, y: 3.0, z: 1.6 },
            lift: 34,
            accent: true,
          },
          {
            from: { x: 4.0, y: 3.0, z: 1.6 },
            to: { x: 6.6, y: 4.6, z: 3.4 },
            lift: 46,
            delay: 900,
          },
        ]}
        nodes={[
          { x: 1.6, y: 1.8, z: 0.9 },
          { x: 6.6, y: 4.6, z: 3.4 },
          { x: 3.6, y: 6.6, z: 1.0 },
        ]}
      />

      {ORDERED.map((volume, i) => (
        <IsoBox key={i} volume={volume} id={id} />
      ))}

      {/* The arch: three volumes read as one at this size, and a true isometric
          arc would cost far more than it shows. */}
      {[ARCH.x, ARCH.x + ARCH.w - ARCH.leg].map((legX) => (
        <IsoBox
          key={legX}
          id={id}
          volume={{ x: legX, y: ARCH.y, w: ARCH.leg, d: ARCH.d, h: ARCH.h - 0.35, top: 'slate' }}
        />
      ))}
      <IsoBox
        id={id}
        volume={{
          x: ARCH.x,
          y: ARCH.y,
          z: ARCH.h - 0.35,
          w: ARCH.w,
          d: ARCH.d,
          h: 0.35,
          top: 'accent',
        }}
      />

      {/* The speaker cone, with rings leaving it. */}
      <Cylinder disc={SPEAKER} height={0.75} hollow />
      <Rings disc={{ ...SPEAKER, z: 0.75 }} />

      {/* A squat drum disc. */}
      <Cylinder disc={{ x: 7.2, y: 6.0, r: 0.6 }} height={0.35} top="slate" />

      <Panel
        box={{ x: 7.2, y: 6.6, z: 3.2, w: 1.3, d: 0.05, h: 0.85 }}
        id={id}
        className="animate-isoFloatSlow"
        style={{ animationDelay: '600ms' }}
      />

      {/* Dressing: a mark round the speaker, and the height of a floater. */}
      <GroundRing x={3.9} y={2.2} r={1.5} />
      <GuideLine x={2.2} y={0.4} z={4.4} />

      <Diamonds
        at={[
          { x: 2.2, y: 0.4, z: 4.4, size: 7, delay: 0 },
          { x: 7.4, y: 2.2, z: 4.9, size: 5, delay: 1200, hollow: true },
          { x: 5.0, y: 7.4, z: 4.1, size: 6, delay: 2400 },
        ]}
      />
    </IsoScene>
  );
}

export default IsoAudioCity;
