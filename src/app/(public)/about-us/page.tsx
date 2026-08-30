import {
  AboutClosing,
  AboutFounder,
  AboutFuture,
  AboutGrid,
  AboutHeart,
  AboutHero,
  AboutMission,
  AboutStory,
  AboutTimeline,
  AboutVision,
} from '@/components/site/about/AboutSections';
import { CtaPanel } from '@/components/site/CtaPanel';
import { ctaPanels } from '@/config/content.config';
import { buildMetadata } from '@/lib/seo';

export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'About Us',
  description:
    'Since 2003, Rejoice has used music, stories and creative media to share faith, hope and the Gospel.',
  path: '/about-us',
});

/**
 * The Rejoice story.
 *
 * Ten sections, each in its own shape — see `AboutSections`. The page itself
 * is just the running order; every section owns its own layout, and all the
 * copy lives in `content.config.ts`.
 *
 * The hero is full-bleed, so this page does NOT wrap everything in
 * `container-page`; each section applies it where it wants it.
 */
export default function AboutPage() {
  return (
    <>
      <AboutHero />
      <AboutStory />
      <AboutGrid />
      <AboutFounder />
      <AboutTimeline />
      <AboutMission />
      <AboutHeart />
      <AboutFuture />
      <AboutVision />
      <AboutClosing />

      <div className="container-page pb-16 sm:pb-24">
        <CtaPanel {...ctaPanels.about} />
      </div>
    </>
  );
}
