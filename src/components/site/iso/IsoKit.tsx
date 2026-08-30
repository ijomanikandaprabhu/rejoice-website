import * as React from 'react';

import { boxFaces, discGeometry, polygon, project, shadowPoly } from './isoMath';
import type { Box, Disc } from './isoMath';

/**
 * The parts every Services panel is drawn from.
 *
 * The four scenes have to look like one set, and the only reliable way to get
 * that is for them to be made of literally the same pieces — same palette, same
 * hatching, same shadow rule, same platform. Anything scene-specific lives in
 * the scene; anything shared lives here.
 *
 * IDS ARE NAMESPACED per scene. All four SVGs sit on one page, and `<pattern>`
 * and `<mask>` are looked up document-wide — four elements sharing an id means
 * every scene silently renders the first scene's hatching.
 */

/** Near-black volume bodies. */
export const BODY = '#0B0A0A';
/** Dim cool grey line work. */
export const LINE = 'rgba(255,255,255,0.28)';
export const LINE_SOFT = 'rgba(255,255,255,0.14)';
/** Matches `site.accent` in tailwind.config.ts. */
export const ACCENT = '#FF6D29';
export const SLATE = '#3A3D45';

/** Marks that can sit on a top face. */
export type Mark = 'dots' | 'faders' | 'play' | 'scrubber' | 'wheels' | 'spark' | 'keys';

export type Volume = Box & {
  top: 'accent' | 'slate' | 'none';
  mark?: Mark;
  /** Outline only, no solid body — something not finished being made. */
  wire?: boolean;
  /** Present on stepped blocks that bob like a meter; staggers the bounce. */
  meterDelay?: number;
};

/** Back-to-front. SVG has no depth buffer, so paint order *is* depth. */
export function sortByDepth(volumes: Volume[]): Volume[] {
  return [...volumes].sort((a, b) => a.x + a.y - (b.x + b.y));
}

export function IsoDefs({ id }: { id: string }) {
  return (
    <defs>
      {/* Fine diagonal hatching for the side faces. */}
      <pattern id={`${id}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse">
        <path d="M-1,1 l2,-2 M0,6 l6,-6 M5,7 l2,-2" stroke={LINE_SOFT} strokeWidth="0.9" />
      </pattern>

      <pattern id={`${id}-grid`} width="26" height="13" patternUnits="userSpaceOnUse">
        <path
          d="M0,6.5 l13,6.5 l13,-6.5 M0,6.5 l13,-6.5 l13,6.5"
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="0.7"
        />
      </pattern>

      <radialGradient id={`${id}-fade`} cx="50%" cy="50%" r="42%">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
        <stop offset="60%" stopColor="#fff" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </radialGradient>

      <mask id={`${id}-grid-mask`}>
        <rect x="-460" y="-320" width="920" height="800" fill={`url(#${id}-fade)`} />
      </mask>
    </defs>
  );
}

/** The ground: an isometric grid fading out toward the edges. */
export function GroundGrid({ id }: { id: string }) {
  return (
    <rect
      x="-460"
      y="-320"
      width="920"
      height="800"
      fill={`url(#${id}-grid)`}
      mask={`url(#${id}-grid-mask)`}
    />
  );
}

/**
 * The slab a city stands on, with its two visible edges.
 *
 * Sized per scene, and omitted entirely by the AI Audio panel — dropping the
 * slab is the single biggest change available to a scene's silhouette, which is
 * what stops four drawings from the same kit reading as one picture.
 */
export function Platform({
  w = 8.9,
  d = 8.2,
  x0 = -0.3,
  y0 = -0.3,
}: {
  w?: number;
  d?: number;
  x0?: number;
  y0?: number;
}) {
  const x1 = x0 + w;
  const y1 = y0 + d;

  return (
    <g strokeWidth="1">
      <polygon
        points={polygon([project(x0, y0), project(x1, y0), project(x1, y1), project(x0, y1)])}
        fill="rgba(255,255,255,0.02)"
        stroke={LINE_SOFT}
      />
      <polygon
        points={polygon([
          project(x1, y0),
          project(x1, y1),
          project(x1, y1, -0.35),
          project(x1, y0, -0.35),
        ])}
        fill={BODY}
        stroke={LINE_SOFT}
      />
      <polygon
        points={polygon([
          project(x0, y1),
          project(x1, y1),
          project(x1, y1, -0.35),
          project(x0, y1, -0.35),
        ])}
        fill={BODY}
        stroke={LINE_SOFT}
      />
    </g>
  );
}

/** Every volume's hard flat shadow, drawn together beneath the city. */
export function Shadows({ volumes }: { volumes: Volume[] }) {
  return (
    <g fill="rgba(0,0,0,0.55)">
      {volumes.map((volume, i) => (
        <polygon key={i} points={shadowPoly(volume, 0.9)} />
      ))}
    </g>
  );
}

export function IsoBox({ volume, id }: { volume: Volume; id: string }) {
  const faces = boxFaces(volume);

  // Wireframe: the same three faces, drawn as outlines with nothing behind
  // them. Used by the AI scenes for volumes still being generated.
  if (volume.wire) {
    return (
      <g fill="none" stroke={LINE} strokeWidth="1" strokeLinejoin="round" opacity="0.6">
        <polygon points={faces.left} />
        <polygon points={faces.right} />
        <polygon points={faces.top} />
      </g>
    );
  }

  const body = (
    <g strokeWidth="1" strokeLinejoin="round">
      <polygon points={faces.left} fill={BODY} stroke={LINE} />
      <polygon points={faces.left} fill={`url(#${id}-hatch)`} stroke="none" />
      <polygon points={faces.right} fill={BODY} stroke={LINE} />
      <polygon points={faces.right} fill={`url(#${id}-hatch)`} stroke="none" />

      {volume.top === 'none' ? null : (
        <polygon points={faces.top} fill={volume.top === 'accent' ? ACCENT : SLATE} stroke={LINE} />
      )}
      {volume.mark ? <TopMark volume={volume} /> : null}
    </g>
  );

  return volume.meterDelay === undefined ? (
    body
  ) : (
    <g className="animate-isoMeter" style={{ animationDelay: `${volume.meterDelay}ms` }}>
      {body}
    </g>
  );
}

/** The small marks the briefs put on top faces. */
function TopMark({ volume }: { volume: Volume }) {
  const { x, y, w, d, z = 0, h, mark } = volume;
  const top = z + h;
  const ink = volume.top === 'accent' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.5)';

  if (mark === 'dots') {
    return (
      <g fill={ink} stroke="none">
        {[0.3, 0.5, 0.7].map((t) => {
          const p = project(x + w * t, y + d * 0.5, top);
          return <circle key={t} cx={p.x} cy={p.y} r="1.8" />;
        })}
      </g>
    );
  }

  if (mark === 'faders' || mark === 'scrubber') {
    const steps = mark === 'faders' ? [0.15, 0.3, 0.45, 0.6, 0.75, 0.9] : [0.2, 0.4, 0.6, 0.8];
    return (
      <g stroke={ink} strokeWidth="1.4" strokeLinecap="round">
        {steps.map((t) => {
          const a = project(x + w * t, y + d * 0.2, top);
          const b = project(x + w * t, y + d * 0.8, top);
          return <line key={t} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
      </g>
    );
  }

  if (mark === 'play') {
    // A triangle in the plane of the top face, so it lies flat rather than
    // floating above it like a sticker.
    const a = project(x + w * 0.32, y + d * 0.25, top);
    const b = project(x + w * 0.32, y + d * 0.75, top);
    const c = project(x + w * 0.78, y + d * 0.5, top);
    return <polygon points={polygon([a, b, c])} fill={ink} stroke="none" />;
  }

  if (mark === 'wheels') {
    return (
      <g fill="none" stroke={ink} strokeWidth="1.1">
        {[0.32, 0.5, 0.68].map((t) => {
          const p = project(x + w * t, y + d * 0.5, top);
          return <ellipse key={t} cx={p.x} cy={p.y} rx="6" ry="3.4" />;
        })}
      </g>
    );
  }

  if (mark === 'keys') {
    return (
      <g stroke={ink} strokeWidth="1" strokeLinecap="round">
        {[0.2, 0.35, 0.5, 0.65, 0.8].map((t) =>
          [0.3, 0.7].map((u) => {
            const a = project(x + w * t, y + d * (u - 0.12), top);
            const b = project(x + w * t, y + d * (u + 0.12), top);
            return <line key={`${t}-${u}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
          }),
        )}
      </g>
    );
  }

  // spark — a small radiating starburst.
  const centre = project(x + w * 0.5, y + d * 0.5, top);
  return (
    <g stroke={ink} strokeWidth="1.2" strokeLinecap="round">
      {[0, 45, 90, 135].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const dx = Math.cos(rad) * 7;
        const dy = Math.sin(rad) * 4;
        return (
          <line
            key={deg}
            x1={centre.x - dx}
            y1={centre.y - dy}
            x2={centre.x + dx}
            y2={centre.y + dy}
          />
        );
      })}
    </g>
  );
}

/** A cylinder: two projected ellipses joined by a barrel. */
export function Cylinder({
  disc,
  height,
  top = 'accent',
  hollow = false,
}: {
  disc: Disc;
  height: number;
  top?: 'accent' | 'slate';
  hollow?: boolean;
}) {
  const base = discGeometry(disc);
  const cap = discGeometry({ ...disc, z: (disc.z ?? 0) + height });
  const inner = discGeometry({ ...disc, z: (disc.z ?? 0) + height, r: disc.r * 0.45 });

  return (
    <g strokeWidth="1">
      <path
        d={`M${base.centre.x - base.rx},${base.centre.y} L${cap.centre.x - cap.rx},${cap.centre.y} A${cap.rx},${cap.ry} 0 0 0 ${cap.centre.x + cap.rx},${cap.centre.y} L${base.centre.x + base.rx},${base.centre.y} A${base.rx},${base.ry} 0 0 1 ${base.centre.x - base.rx},${base.centre.y} Z`}
        fill={BODY}
        stroke={LINE}
      />
      <ellipse
        cx={cap.centre.x}
        cy={cap.centre.y}
        rx={cap.rx}
        ry={cap.ry}
        fill={top === 'accent' ? ACCENT : SLATE}
        stroke={LINE}
      />
      {hollow ? (
        <ellipse
          cx={inner.centre.x}
          cy={inner.centre.y}
          rx={inner.rx}
          ry={inner.ry}
          fill={BODY}
          stroke="none"
        />
      ) : null}
    </g>
  );
}

/** Rings pushing out of a disc — a speaker cone, or a pulse from a core. */
export function Rings({ disc, delays = [0, 1400] }: { disc: Disc; delays?: number[] }) {
  const cap = discGeometry(disc);

  return (
    <g fill="none" strokeWidth="1">
      {delays.map((delay) => (
        <ellipse
          key={delay}
          cx={cap.centre.x}
          cy={cap.centre.y}
          rx={cap.rx}
          ry={cap.ry}
          stroke={ACCENT}
          className="animate-isoPing"
          style={{
            animationDelay: `${delay}ms`,
            transformOrigin: `${cap.centre.x}px ${cap.centre.y}px`,
          }}
        />
      ))}
    </g>
  );
}

export type RoutingPoint = { x: number; y: number; z?: number };

/**
 * Cables looping between volumes, drawn as free curves in screen space rather
 * than projected geometry — they hang in the air, so they read better as arcs
 * than as anything grid-aligned.
 */
export function RoutingLines({
  legs,
  nodes,
}: {
  legs: {
    from: RoutingPoint;
    to: RoutingPoint;
    /** How far the curve bows upward. Zero draws a straight run. */
    lift: number;
    accent?: boolean;
    delay?: number;
  }[];
  nodes: RoutingPoint[];
}) {
  return (
    <g fill="none" strokeWidth="1.2" strokeLinecap="round">
      {legs.map((leg, i) => {
        const a = project(leg.from.x, leg.from.y, leg.from.z ?? 0);
        const b = project(leg.to.x, leg.to.y, leg.to.z ?? 0);
        // `lift: 0` gives a straight line — a network link rather than a cable
        // slung through the air.
        const d =
          leg.lift === 0
            ? `M${a.x},${a.y} L${b.x},${b.y}`
            : `M${a.x},${a.y} Q${(a.x + b.x) / 2},${Math.min(a.y, b.y) - leg.lift} ${b.x},${b.y}`;

        return (
          <path
            key={i}
            d={d}
            stroke={leg.accent ? ACCENT : LINE}
            strokeDasharray={leg.accent ? '5 5' : '4 6'}
            className="animate-isoDash"
            style={{ animationDelay: `${leg.delay ?? 0}ms` }}
          />
        );
      })}

      {nodes.map((node, i) => {
        const p = project(node.x, node.y, node.z ?? 0);
        return (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r="3"
              fill={ACCENT}
              stroke="none"
              className="animate-isoPulse"
              style={{ animationDelay: `${i * 700}ms` }}
            />
            <circle cx={p.x} cy={p.y} r="6.5" stroke={LINE_SOFT} strokeWidth="1" />
          </g>
        );
      })}
    </g>
  );
}

/**
 * A dashed plumb line from a floating object down to the ground, with a small
 * ring where it lands. Technical-drawing dressing — it tells the eye how high
 * something is, which flat isometric otherwise leaves ambiguous.
 */
export function GuideLine({ x, y, z }: { x: number; y: number; z: number }) {
  const top = project(x, y, z);
  const foot = project(x, y, 0);
  const ring = discGeometry({ x, y, r: 0.35 });

  return (
    <g fill="none" stroke={LINE_SOFT} strokeWidth="0.9">
      <line x1={top.x} y1={top.y} x2={foot.x} y2={foot.y} strokeDasharray="3 4" />
      <ellipse cx={ring.centre.x} cy={ring.centre.y} rx={ring.rx} ry={ring.ry} />
    </g>
  );
}

/** A ring drawn flat on the ground around a volume, marking it out. */
export function GroundRing({ x, y, r }: { x: number; y: number; r: number }) {
  const ring = discGeometry({ x, y, r });

  return (
    <ellipse
      cx={ring.centre.x}
      cy={ring.centre.y}
      rx={ring.rx}
      ry={ring.ry}
      fill="none"
      stroke={ACCENT}
      strokeOpacity="0.4"
      strokeWidth="1"
      strokeDasharray="4 5"
      className="animate-isoDash"
    />
  );
}

/** Small diamonds drifting above the city. */
export function Diamonds({
  at,
}: {
  at: { x: number; y: number; z: number; size: number; delay: number; hollow?: boolean }[];
}) {
  return (
    <g>
      {at.map((shape, i) => {
        const p = project(shape.x, shape.y, shape.z);
        return (
          <polygon
            key={i}
            points={polygon([
              { x: p.x, y: p.y - shape.size },
              { x: p.x + shape.size, y: p.y },
              { x: p.x, y: p.y + shape.size },
              { x: p.x - shape.size, y: p.y },
            ])}
            fill={shape.hollow ? 'none' : ACCENT}
            stroke={shape.hollow ? LINE : 'none'}
            strokeWidth="1"
            className="animate-isoFloatSlow"
            style={{ animationDelay: `${shape.delay}ms` }}
          />
        );
      })}
    </g>
  );
}

/**
 * A thin panel standing in the air — a screen, a waveform ribbon, a generated
 * frame. `d` of near zero is what makes it a plane rather than a slab.
 */
export function Panel({
  box,
  id,
  fill = 'body',
  className,
  style,
}: {
  box: Box;
  id: string;
  fill?: 'body' | 'accent' | 'none';
  className?: string;
  style?: React.CSSProperties;
}) {
  const faces = boxFaces({ ...box, d: box.d || 0.06 });

  return (
    <g strokeWidth="1" strokeLinejoin="round" className={className} style={style}>
      <polygon
        points={faces.right}
        fill={fill === 'accent' ? ACCENT : fill === 'none' ? 'none' : BODY}
        stroke={LINE}
      />
      {fill === 'body' ? (
        <polygon points={faces.right} fill={`url(#${id}-hatch)`} stroke="none" />
      ) : null}
      <polygon points={faces.top} fill="none" stroke={LINE} />
    </g>
  );
}

/**
 * The frame every scene sits in.
 *
 * The viewBox is framed on the drawn content rather than the origin — the
 * projection puts a 9 × 8 platform well left of and below (0,0), so an
 * origin-centred box leaves the city hanging in a corner.
 */
export function IsoScene({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox="-300 -118 608 380"
      // Decorative: the heading and copy beside it carry the meaning.
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <IsoDefs id={id} />
      <g className="animate-isoFloat" transform="translate(-115, -60)">
        <GroundGrid id={id} />
        {children}
      </g>
    </svg>
  );
}
