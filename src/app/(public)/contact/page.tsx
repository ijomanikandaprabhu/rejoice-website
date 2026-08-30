import { ContactForm } from '@/components/common/ContactForm';
import { MailSolid, PhoneSolid, PinSolid } from '@/components/common/icons/ContactIcons';
import { ContactMap } from '@/components/site/ContactMap';
import { CtaPanel, GridBackdrop } from '@/components/site/CtaPanel';
import { PageHero } from '@/components/site/PageHero';
import { SocialButtons } from '@/components/site/SocialButtons';
import { contactForm, contactPage, services } from '@/config/content.config';
import { getContactDetails } from '@/features/content/queries';
import { getSocialSettings } from '@/features/settings/queries';
import { buildMetadata } from '@/lib/seo';

export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'Contact',
  description:
    'Have a song, story, video, ministry project or creative idea in mind? Tell Rejoice about it.',
  path: '/contact',
});

/** The bordered tile the details sit in. `h-full` so a row of them squares up. */
function DetailCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full rounded-[16px] border border-white/10 bg-site-surface p-6">
      {children}
    </div>
  );
}

/**
 * One labelled line inside a tile.
 *
 * Renders nothing when its setting is empty — an administrator who has not
 * filled a field in should get no output, not a label sitting over empty space.
 */
function DetailRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: (props: { className?: string }) => JSX.Element;
  label: string;
  value: string;
  href?: string;
}) {
  if (!value) return null;

  /*
   * The WHOLE row is the link, icon and label included — not just the value.
   *
   * Wrapping only the value left the mail icon and the word "Email" inert, so
   * the most obvious thing to click on a contact detail did nothing. A row that
   * looks like one unit should behave like one.
   */
  const body = (
    <>
      <span className="flex items-center gap-2.5">
        <Icon className="size-4 text-site-accent" />
        <span className="t-label">{label}</span>
      </span>
      <span className="mt-2 block whitespace-pre-line text-body leading-[1.7] text-site-fg">
        {value}
      </span>
    </>
  );

  if (!href) return <div>{body}</div>;

  return (
    <a href={href} className="block transition-colors hover:text-site-accent">
      {body}
    </a>
  );
}

/**
 * Contact.
 *
 * Hero, the enquiry form, the direct details beside it, and a closing block
 * whose button returns to the form.
 *
 * This is the one page with no footer CTA panel: the closing block below IS the
 * call to action, and two of them in a row is the mistake the About page made
 * before it was fixed.
 */
export default async function ContactPage({
  searchParams,
}: {
  searchParams: { service?: string };
}) {
  const [details, social] = await Promise.all([getContactDetails(), getSocialSettings()]);
  const { hero, form, details: detailsCopy, closing } = contactPage;

  /*
   * `/contact?service=<id>` — every Services page button carries one, so an
   * enquiry can be traced back to the offering it came from. The slug is a
   * `services` id and each title is also the matching entry in
   * `contactForm.interests`, so no separate lookup table is needed. Anything
   * unrecognised is ignored and the select simply starts empty.
   */
  const fromService = services.find((service) => service.id === searchParams.service);
  const preselectedInterest = contactForm.interests.find(
    (interest) => interest === fromService?.title,
  );

  return (
    <>
      <PageHero
        heading={hero.heading}
        paragraphs={hero.paragraphs}
        accentLine={hero.closing}
        wordmark="Contact"
        gridOffset={70}
      />

      {/*
        The enquiry form, full width and centred.

        This and the details below used to sit side by side. They could not be
        made to line up: each column's content began wherever its own intro
        happened to end, so the form panel started 71px below the first detail
        card while the eyebrow labels above them aligned exactly — which read as
        a mistake rather than as asymmetry. Stacking removes the problem at its
        source instead of tying the two columns together.
      */}
      <section id="enquiry" className="container-page scroll-mt-24 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="t-label">{form.eyebrow}</p>
          <h2 className="t-h2 mt-4">{form.heading}</h2>

          {form.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-4 text-body leading-[1.7] text-site-muted">
              {paragraph}
            </p>
          ))}

          {/*
            The panel is dressed from the site's existing kit rather than a new
            treatment: `card-gloss` for the lit top edge and hover sheen (the
            same class `VideoTile` and this form's own success state use),
            `GridBackdrop` for the radial-masked grid it shares with the CTA
            panel, and an ember wash so it reads as lit rather than as a flat
            box. `animate-riseIn` is the site's standard entrance and is
            neutralised by the global reduced-motion rule.
          */}
          <div className="card-gloss mt-10 animate-riseIn p-6 sm:p-8">
            {/* Dimmed at the CALL SITE, not in the component: `GridBackdrop`
                is shared with the Services media panels, where the full
                strength is right. This one sits behind form fields. */}
            <GridBackdrop className="opacity-40" />
            <span aria-hidden="true" className="absolute inset-0 bg-emberSoft opacity-40" />

            <div className="relative z-20">
              <ContactForm defaultInterest={preselectedInterest} />
            </div>
          </div>
        </div>
      </section>

      {/* Direct details, beneath the form. */}
      <section className="container-page pb-16 sm:pb-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="t-label">{detailsCopy.eyebrow}</p>
          <h2 className="t-h3 mt-3 text-site-fg">{detailsCopy.heading}</h2>
          <p className="mt-3 text-body leading-[1.7] text-site-muted">{detailsCopy.text}</p>
        </div>

        {/* `items-stretch` plus `h-full` so the tall address tile sets the row
            and the others match, rather than sitting ragged. */}
        <div className="mt-10 grid items-stretch gap-4 sm:grid-cols-3">
          <DetailCard>
            <DetailRow icon={PinSolid} label={detailsCopy.labels.address} value={details.address} />
          </DetailCard>

          {/*
            Phone and email share a tile. Apart they were a single short line
            each, leaving both boxes mostly empty beside the four-line address.

            `space-y-6` rather than a divider rule: the tile is already bordered,
            and an internal rule would read as two stacked cards.
          */}
          {details.phone || details.email ? (
            <DetailCard>
              <div className="space-y-6">
                <DetailRow
                  icon={PhoneSolid}
                  label={detailsCopy.labels.phone}
                  value={details.phone}
                  href={details.phone ? `tel:${details.phone.replace(/\s/g, '')}` : undefined}
                />
                <DetailRow
                  icon={MailSolid}
                  label={detailsCopy.labels.email}
                  value={details.email}
                  href={details.email ? `mailto:${details.email}` : undefined}
                />
              </div>
            </DetailCard>
          ) : null}

          {/*
            The accounts, as the site's own brand-tinted buttons rather than the
            plain text pills that used to float below this row. `SocialButtons`
            already does the per-brand tint, the uploaded icon and the accessible
            name; no `shareTitle` is passed, so it omits the share button — there
            is nothing to share from a details tile.
          */}
          {social.links.length > 0 ? (
            <DetailCard>
              {/* Centred on both axes, and with no kicker: the buttons carry
                  their own accessible names and tooltips, so a label above them
                  only repeats what they already say. `h-full` is what gives
                  `items-center` something to centre within — the tile's height
                  comes from the address tile beside it, not from this content. */}
              <div className="flex h-full items-center justify-center">
                <SocialButtons links={social.links} />
              </div>
            </DetailCard>
          ) : null}
        </div>
      </section>

      {/* Where to find us. Sits between the details and the closing block. */}
      <section className="container-page pb-16 sm:pb-20">
        <ContactMap address={details.address} />
      </section>

      {/*
        Closing. No button, and no footer CTA panel either: the enquiry form is
        directly above, so this is a closing statement rather than a second ask.
        `CtaPanel` leaves the button out when no `ctaLabel`/`ctaHref` is given.

        The shared `CtaPanel` rather than a bespoke block: this used to be
        hand-rolled and had drifted from every other page's closing panel — no
        wordmark, a flat ember wash instead of the glow-grid-vignette backdrop,
        and a different heading scale. The panel takes `paragraphs` and
        `accentLine` so contact's richer copy fits the shared component instead
        of justifying a second one.
      */}
      <div className="container-page pb-20 sm:pb-28">
        <CtaPanel
          heading={closing.heading}
          paragraphs={closing.paragraphs}
          accentLine={closing.line}
        />
      </div>

    </>
  );
}
