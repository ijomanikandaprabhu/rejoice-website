import { ArrowRight } from 'lucide-react';
import Image from 'next/image';

import { IsoAiAudioCity } from '@/components/site/iso/IsoAiAudioCity';
import { IsoAiVideoCity } from '@/components/site/iso/IsoAiVideoCity';
import { IsoAudioCity } from '@/components/site/iso/IsoAudioCity';
import { IsoVideoCity } from '@/components/site/iso/IsoVideoCity';
import { CtaPanel, GridBackdrop } from '@/components/site/CtaPanel';
import { EmptyPanel, SiteButton } from '@/components/site/Section';
import { PageHero } from '@/components/site/PageHero';
import { ctaPanels, servicesPage } from '@/config/content.config';
import { getVisibleServices } from '@/features/content/queries';
import { buildMetadata } from '@/lib/seo';
import { cn } from '@/lib/utils';

/**
 * Artwork per offering, drawn rather than photographed — isometric scenes built
 * from the shared kit in `components/site/iso`. Keyed by the service `id`, so an
 * offering with no scene yet falls back to the placeholder panel below.
 */
const SCENES: Record<string, (props: { className?: string }) => JSX.Element> = {
  'audio-production': IsoAudioCity,
  'video-production': IsoVideoCity,
  'ai-audio-production': IsoAiAudioCity,
  'ai-video-production': IsoAiVideoCity,
};

export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'Services',
  description:
    'Audio production, video production and AI-powered creative production from Rejoice — from concept to final delivery.',
  path: '/services',
});

/**
 * The artwork area of a cell: a faint square grid, the drawing on top, corner
 * brackets and edge ticks around it, and a rule beneath.
 *
 * The backdrop grid is CSS rather than part of the SVG on purpose. It belongs
 * to the PAGE, not to the drawn world — it stays orthogonal while the scene's
 * own ground grid is isometric, and the two different angles and pitches are
 * what keep them from moiring into each other.
 */
function MediaPanel({
  image,
  scene: Scene,
}: {
  image?: string;
  scene?: (props: { className?: string }) => JSX.Element;
}) {
  return (
    <div className="relative border-b border-white/[0.08] px-6 pb-8 pt-8 md:px-8">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[14px] bg-site-bg">
        {/* Shared with the CTA panel, so the two never drift apart. */}
        <GridBackdrop />

        {image ? (
          // A supplied photograph still wins over the drawn scene.
          <Image
            src={image}
            alt=""
            fill
            sizes="(min-width: 768px) 45vw, 100vw"
            className="object-cover"
          />
        ) : Scene ? (
          <Scene className="absolute inset-0 size-full" />
        ) : (
          <span aria-hidden="true" className="absolute inset-0 bg-emberSoft" />
        )}
      </div>

      {/* Corner brackets and edge ticks — the technical-drawing dressing the
          reference frames its images with. */}
      <PanelMarks />
    </div>
  );
}

/** Four corner brackets, a few edge ticks and a registration crosshair. */
function PanelMarks() {
  const bracket = 'absolute size-3 border-white/25';

  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-4 md:inset-5">
      <span className={cn(bracket, 'left-0 top-0 border-l border-t')} />
      <span className={cn(bracket, 'right-0 top-0 border-r border-t')} />
      <span className={cn(bracket, 'bottom-0 left-0 border-b border-l')} />
      <span className={cn(bracket, 'bottom-0 right-0 border-b border-r')} />

      {/* A short measurement scale along the top and bottom edges. */}
      {[0.3, 0.4, 0.5, 0.6, 0.7].map((t) => (
        <span key={t}>
          <span className="absolute top-0 h-1.5 w-px bg-white/15" style={{ left: `${t * 100}%` }} />
          <span
            className="absolute bottom-0 h-1.5 w-px bg-white/15"
            style={{ left: `${t * 100}%` }}
          />
        </span>
      ))}

      <span className="absolute left-6 top-6 size-2.5 rounded-pill border border-white/10" />
    </span>
  );
}

/**
 * What we make.
 *
 * Four offerings, each a full-width block: artwork on one side, the writing on
 * the other, alternating down the page. The supplied reference is an editorial
 * grid rather than a card wall, which suits copy this long — each offering
 * carries two paragraphs and a list of a dozen or more specific services, and
 * none of that fits in a card.
 *
 * All wording lives in `content.config.ts`, so it is edited in one file.
 */
export default function ServicesPage() {
  const services = getVisibleServices();

  return (
    <>
      {/* Full-bleed, like About — so this page does NOT wrap everything in
          `container-page`; the hero applies it inside itself. */}
      <PageHero heading={servicesPage.heading} paragraphs={servicesPage.intro} />

      <div className="container-page pb-14 sm:pb-20">
        {services.length === 0 ? (
          <div className="mt-12">
            <EmptyPanel
              title="Services are being written"
              description="Add them to src/config/content.config.ts."
            />
          </div>
        ) : (
          /*
           * Two cells per row, divided by hairlines — the supplied reference is a
           * drawn grid, not a stack of full-width rows. The outer edges are
           * suppressed so the rules read as internal dividers rather than a box
           * around the whole block, which is how the reference is framed.
           */
          <div className="mt-16 grid border-white/[0.08] sm:mt-20 md:grid-cols-2">
            {services.map((service) => {
              const Scene = SCENES[service.id];

              return (
                <section
                  key={service.id}
                  id={service.id}
                  className={cn(
                    'flex scroll-mt-24 flex-col border-t border-white/[0.08] pb-12 sm:pb-14',
                    // No top rule on the first row, no left rule on the first
                    // column: the frame is open on the outside.
                    'first:border-t-0 md:[&:nth-child(-n+2)]:border-t-0',
                    'md:border-l md:[&:nth-child(odd)]:border-l-0',
                  )}
                >
                  <MediaPanel image={service.image} scene={Scene} />

                  {/* A flex column that fills the cell, so the button below can be pinned
                    to the bottom. `min-w-0` stays: it is what stops the long service
                    names forcing the grid column wider than its track. */}
                  <div className="flex min-w-0 flex-1 flex-col px-0 pt-8 md:px-8 md:first-of-type:pl-0">
                    <h2 className="text-[1.25rem] font-black uppercase tracking-[0.14em] text-site-fg sm:text-[1.5rem]">
                      {service.title}
                    </h2>
                    <p className="t-h3 mt-3 text-site-fg">{service.headline}</p>

                    <p className="mt-4 text-body leading-[1.7] text-site-muted">{service.lead}</p>
                    <p className="mt-3 text-body leading-[1.7] text-site-muted">{service.body}</p>

                    <p className="t-label mt-7">Our services</p>
                    {/* A list this long as bullets would run to most of a screen;
                        two columns of hairline-separated rows keeps it scannable. */}
                    <ul className="mt-3 grid gap-x-8 sm:grid-cols-2">
                      {service.items.map((item) => (
                        <li
                          key={item}
                          data-reveal
                          className="border-b border-white/[0.06] py-2.5 text-sm text-site-muted"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>

                    <p className="mt-6 text-body leading-[1.7] text-site-fg">{service.closing}</p>

                    {/*
                      `mt-auto`, not `mt-6`: the offerings list different numbers
                      of services, so without this the two buttons in a row ended
                      up 41px apart, each following wherever its own copy stopped.
                      Absorbing the slack above pins both to the bottom of their
                      cell, and the cells are already equal height.

                      `pt-6` keeps the gap after the closing paragraph that
                      `mt-6` used to provide — `mt-auto` drops it whenever there
                      is spare space to eat.
                    */}
                    <div className="mt-auto pt-6">
                      <SiteButton href={service.ctaHref} className="group">
                        {service.ctaLabel}
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                        />
                      </SiteButton>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <CtaPanel {...ctaPanels.services} className="mt-16 sm:mt-20" />
      </div>
    </>
  );
}
