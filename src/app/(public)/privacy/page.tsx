import { LegalDocument } from '@/components/site/LegalDocument';
import { PageHero } from '@/components/site/PageHero';
import { privacyPolicy } from '@/config/legal.config';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Privacy Policy',
  description:
    'What Rejoice does with the information you send through this website. No analytics, no tracking, and no cookies.',
  path: '/privacy',
});

/**
 * Privacy Policy.
 *
 * The copy lives in `legal.config.ts`, which also records the evidence behind
 * each factual claim — several of them are strong ("no analytics", "no
 * cookies") and are only true while the code stays that way.
 */
export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        heading={privacyPolicy.title}
        paragraphs={privacyPolicy.intro}
      />
      <LegalDocument document={privacyPolicy} />
    </>
  );
}
