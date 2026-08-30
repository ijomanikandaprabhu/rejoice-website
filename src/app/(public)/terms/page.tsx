import { LegalDocument } from '@/components/site/LegalDocument';
import { PageHero } from '@/components/site/PageHero';
import { termsOfUse } from '@/config/legal.config';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Terms of Use',
  description:
    'The terms that apply to using the Rejoice website, and to the music, films and video production shown on it.',
  path: '/terms',
});

/** Terms of Use. Copy lives in `legal.config.ts`; see the Privacy Policy page. */
export default function TermsPage() {
  return (
    <>
      <PageHero eyebrow="Legal" heading={termsOfUse.title} paragraphs={termsOfUse.intro} />
      <LegalDocument document={termsOfUse} />
    </>
  );
}
