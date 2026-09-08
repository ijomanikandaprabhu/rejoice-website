'use client';

import 'maplibre-gl/dist/maplibre-gl.css';

import { useEffect, useRef } from 'react';

import { contactPage } from '@/config/content.config';

/**
 * The studio's location: a dark, tilted 3D map.
 *
 * MapLibre GL JS (the open-source fork of Mapbox GL JS) drawing OpenFreeMap
 * tiles. That pairing is deliberate — OpenFreeMap needs no API key, no account
 * and sets no cookies, and permits commercial use, so there is no token to
 * manage and no per-view billing meter. Mapbox bills a "map load" every time a
 * Map object is initialised, which on a contact page means once per visitor.
 *
 * The 3D buildings are added here rather than coming from the style. Neither of
 * OpenFreeMap's dark styles carries extrusions — checked: `dark` and `fiord`
 * have no `fill-extrusion` layer at all, and the only style that does
 * (`liberty`) is light. Since `dark` exposes the same `openmaptiles` vector
 * source with its `building` source-layer, the extrusion layer is added on load
 * using the same `render_height` / `render_min_height` fields liberty uses.
 *
 * Attribution stays on. OpenFreeMap's terms require crediting OpenFreeMap,
 * OpenMapTiles and OpenStreetMap, and MapLibre renders it automatically — do
 * not disable `attributionControl`.
 */
export function ContactMap({ address }: { address: string }) {
  const container = useRef<HTMLDivElement>(null);
  const { lat, lng, zoom } = contactPage.map;

  useEffect(() => {
    if (!container.current) return;

    let map: import('maplibre-gl').Map | undefined;
    let cancelled = false;

    /*
     * Imported inside the effect rather than at module scope: MapLibre touches
     * `window` on evaluation, and this keeps ~200KB out of anything that is not
     * actually rendering the map.
     */
    void import('maplibre-gl').then(({ Map, Marker, NavigationControl, setWorkerUrl }) => {
      if (cancelled || !container.current) return;

      /*
       * MapLibre finds its Web Worker from its OWN `import.meta.url`, resolving
       * `./maplibre-gl-worker.mjs` beside itself. Under Next that lands on
       * `/_next/static/chunks/maplibre-gl-worker.mjs`, which does not exist —
       * Next answers with its 404 HTML page, the browser refuses it for the
       * `text/html` MIME type, and the worker never starts. The map then draws
       * its controls and marker but no tiles, because tile fetching and
       * decoding both live in that worker.
       *
       * Letting webpack emit the worker as an asset does not fix it either: the
       * worker `import`s `./maplibre-gl-shared.mjs`, and only the worker file
       * gets emitted, so the sibling 404s the same way. Both files are copied
       * to `public/maplibre/` by `scripts/sync-maplibre-worker.mjs`, wired to
       * `predev` and `prebuild` so the copy cannot drift.
       */
      setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

      map = new Map({
        container: container.current,
        style: 'https://tiles.openfreemap.org/styles/dark',
        // MapLibre takes lng FIRST — the reverse of how coordinates are written,
        // and the quiet way to end up in the wrong hemisphere.
        center: [lng, lat],
        zoom,
        pitch: 60,
        bearing: -22,
        // A map inside a page should not steal the wheel from the page.
        scrollZoom: false,
      });

      /*
       * No reduced-motion option is set, and none is needed: MapLibre honours
       * `prefers-reduced-motion` for camera animations by default — which is
       * why its API offers `essential: true` to opt a movement OUT of that
       * rather than a flag to opt in.
       */

      map.addControl(new NavigationControl({ showCompass: true }), 'top-right');
      new Marker({ color: '#FF6D29' }).setLngLat([lng, lat]).addTo(map);

      /*
       * MapLibre's attribution links carry `target="_blank"` but no `rel`. They
       * are third-party markup — the control is required by OpenFreeMap's terms,
       * so it cannot simply be removed — and a page opened without `noopener`
       * gets a `window.opener` handle back to this one. Modern browsers imply
       * `noopener` for `target="_blank"`, so this is belt and braces rather than
       * a live hole; it costs one line and makes every external link on the site
       * consistent.
       */
      const secureAttribution = () => {
        const root = container.current;
        if (!root) return;
        for (const link of root.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')) {
          link.rel = 'noopener noreferrer';
        }
      };

      map.on('load', () => {
        if (!map) return;
        secureAttribution();
        map.addLayer({
          id: 'building-3d',
          type: 'fill-extrusion',
          source: 'openmaptiles',
          'source-layer': 'building',
          minzoom: 14,
          paint: {
            'fill-extrusion-base': ['get', 'render_min_height'],
            'fill-extrusion-height': ['get', 'render_height'],
            'fill-extrusion-color': '#2C2A2E',
            'fill-extrusion-opacity': 0.9,
          },
        });
      });
    });

    /*
     * Required, not tidiness. React StrictMode double-invokes effects in
     * development, so without this every mount leaks a second Map and its WebGL
     * context — and browsers cap how many contexts a page may hold.
     */
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng, zoom]);

  return (
    /* No border, no fill, no rounding: the canvas fades out at its edges
       instead (see `.map-fade` in globals.css), and an outline would draw back
       the rectangle the fade exists to remove. */
    <div className="map-fade relative">
      <div
        ref={container}
        role="img"
        aria-label={`Map showing Rejoice Gospel Communications at ${address}`}
        className="h-[340px] w-full sm:h-[460px]"
      />

      {/* Directions still belong to a mapping app, so the link out stays. It
          sits above the canvas rather than over it, so it cannot swallow drags. */}
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute left-4 top-4 z-10 inline-flex rounded-pill border border-white/15 bg-black/70 px-4 py-2 text-sm text-site-fg backdrop-blur transition-colors hover:border-site-accent hover:text-site-accent"
      >
        Get directions
      </a>
    </div>
  );
}
