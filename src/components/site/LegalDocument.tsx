import type { LegalDocumentContent } from '@/config/legal.config';

/**
 * Renders a legal document from `legal.config.ts`.
 *
 * One component for both the Privacy Policy and the Terms, so the two cannot
 * drift into looking like different websites.
 *
 * `max-w-3xl` rather than the full `container-page` width: these are the only
 * pages on the site that are a long run of prose, and a line of text stretched
 * across a 1152px container is genuinely hard to read. The container still
 * provides the page gutters.
 */
export function LegalDocument({ document }: { document: LegalDocumentContent }) {
  return (
    <div className="container-page pb-20 sm:pb-28">
      <div className="max-w-3xl">
        {/* The intro is NOT rendered here — the page hero already shows it,
            and printing it twice made the document look like it stuttered. */}
        <p className="t-label">Last updated {document.lastUpdated}</p>

        <div className="mt-10 space-y-12">
          {document.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="t-h3 font-medium text-site-fg">{section.heading}</h2>

              <div className="mt-4 space-y-4">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="t-body leading-[1.7]">
                    {paragraph}
                  </p>
                ))}
              </div>

              {section.bullets ? (
                <ul className="mt-4 space-y-3">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3">
                      {/* `mt-[0.6em]` rather than a fixed value: the dot then
                          sits on the first line's centre at any text size. */}
                      <span
                        aria-hidden
                        className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-site-accent"
                      />
                      <span className="t-body leading-[1.7]">{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
