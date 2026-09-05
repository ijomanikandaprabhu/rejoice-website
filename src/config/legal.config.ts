/**
 * Privacy Policy and Terms of Use.
 *
 * Copy lives in config rather than JSX, matching the rest of the public site
 * (section 3.2 / `content.config.ts`). Kept in its own file because these two
 * documents are long and change on a schedule of their own.
 *
 * EVERY FACTUAL CLAIM HERE WAS CHECKED AGAINST THE CODE, and several are
 * unusually strong — no analytics, no visitor cookies, no third-party fonts.
 * They are only true while that stays true. If a tracker, a cookie, an
 * embedded widget or a new form is ever added, this file is wrong until it is
 * updated, so treat it as part of that change rather than as documentation to
 * catch up on later. The claims and where they come from:
 *
 *   "no analytics"        — nothing matching gtag/GTM/Plausible/PostHog/
 *                           Hotjar/Pixel/Sentry exists anywhere in src.
 *   "no visitor cookies"  — the only cookies are the administrator session
 *                           (src/lib/auth) and the admin-only OAuth `state`
 *                           cookie (src/app/api/youtube/oauth/route.ts).
 *   "fonts are not fetched
 *    from Google"         — `next/font/google` in src/app/layout.tsx
 *                           self-hosts the files at build time.
 *   "thumbnails do not
 *    reach YouTube"       — src/app/api/image/route.ts fetches them server
 *                           side and serves them from this domain; the loader
 *                           at src/lib/images/youtubeLoader.ts is what points
 *                           every next/image at that route. (This used to be
 *                           next/image's own optimizer, which was metered and
 *                           ran out — the claim is unchanged, the mechanism
 *                           behind it is not.)
 *   "IP addresses are not
 *    stored"              — src/lib/utils/rateLimit.ts holds them in an
 *                           in-memory Map and never writes them anywhere.
 *   the form's fields     — `contactSchema` in src/lib/validation.
 *   the 24-month period   — a commitment made by Rejoice, not something the
 *                           code enforces. There is no automatic deletion job;
 *                           if one is ever written, it must use this number.
 */

export type LegalSection = {
  heading: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

export type LegalDocumentContent = {
  title: string;
  /**
   * Written by hand, never `new Date()`. A generated date would claim the
   * document changed on every deployment, which is exactly the assurance a
   * "last updated" line is supposed to give.
   */
  lastUpdated: string;
  intro: readonly string[];
  sections: readonly LegalSection[];
};

/** Repeated in both documents, so it cannot drift between them. */
const CONTACT = {
  name: 'Rejoice Gospel Communications',
  email: 'rejoicegospelcommunications@gmail.com',
  address: 'No. 577, Vincent’s Villa, First Main Road, Ram Nagar North, Madipakkam, Chennai 600091, Tamil Nadu, India',
} as const;

export const privacyPolicy: LegalDocumentContent = {
  title: 'Privacy Policy',
  lastUpdated: '30 August 2026',
  intro: [
    `This policy explains what ${CONTACT.name} does with personal information collected through this website. It describes what the site actually does, not what a template says it might.`,
    'The short version: the only personal information we collect is what you type into the contact form. There is no analytics, no advertising, no tracking, and the site sets no cookies on your browser.',
  ],
  sections: [
    {
      heading: 'Who we are',
      paragraphs: [
        `This website is operated by ${CONTACT.name}, ${CONTACT.address}.`,
        `For anything in this policy, including a request to see or delete your information, write to ${CONTACT.email}.`,
      ],
    },
    {
      heading: 'What we collect',
      paragraphs: [
        'Only what you send us through the contact form:',
      ],
      bullets: [
        'Your name',
        'Your email address',
        'Your phone number, if you choose to give one',
        'A subject, if you choose to give one',
        'The message you write',
      ],
    },
    {
      heading: 'What we do not collect',
      paragraphs: [
        'This is worth stating plainly, because most websites cannot say it:',
      ],
      bullets: [
        'No analytics. The site carries no Google Analytics, no Tag Manager, no advertising or social media pixels, and no error or session-recording service.',
        'No cookies. Browsing this site sets no cookies on your device. The only cookie the site ever creates is a sign-in cookie for the Rejoice administrator, on a separate part of the site the public cannot reach. Because of this, there is no cookie banner to click through.',
        'No accounts, no passwords, no payment details. Nothing is sold on this site.',
        'No IP address logging. Your address is held briefly in memory to stop the contact form being flooded, and is never written to our database or to any log we keep.',
        'No profiling, no automated decision-making, and nothing is sold or rented to anyone.',
      ],
    },
    {
      heading: 'Why we hold it, and for how long',
      paragraphs: [
        'We use what you send for one purpose: to read your enquiry and reply to it. We do not add you to a mailing list, and we will not send you anything you did not ask for.',
        'Enquiries are kept for up to 24 months so that we can look back at earlier conversations, and are then deleted.',
        `You can ask us to delete your enquiry sooner, at any time and without giving a reason. Email ${CONTACT.email} and we will remove it.`,
      ],
    },
    {
      heading: 'Who else is involved',
      paragraphs: [
        'We do not share your information with anyone for their own purposes. A small number of service providers necessarily handle it in order to run the site:',
      ],
      bullets: [
        'Vercel — hosts the website and runs the contact form.',
        'Neon — provides the database where enquiries are stored. Our database is located in Singapore.',
        'Google (Gmail) — delivers the notification email telling us that your enquiry has arrived.',
        'Because these providers operate internationally, your information may be processed outside India.',
      ],
    },
    {
      heading: 'Content embedded from other services',
      paragraphs: [
        'Two parts of the site load content from elsewhere, which means your browser contacts those services directly. We do not control what they collect, and their own privacy policies apply.',
      ],
      bullets: [
        'YouTube — every video on this site is hosted on YouTube. We use YouTube’s privacy-enhanced player, so YouTube is contacted only when you actually press play, not merely when a page loads. Video thumbnails are served through our own domain rather than from YouTube, so simply browsing does not tell YouTube anything.',
        'OpenFreeMap — supplies the map tiles on the contact page.',
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: [
        'Under India’s Digital Personal Data Protection Act 2023, and comparable laws elsewhere, you may:',
      ],
      bullets: [
        'Ask what personal information we hold about you',
        'Ask us to correct anything that is wrong or incomplete',
        'Ask us to delete it',
        'Withdraw your consent, which you give by choosing to send the form',
        'Nominate someone to exercise these rights on your behalf',
      ],
    },
    {
      heading: 'How to exercise them, and how to complain',
      paragraphs: [
        `Email ${CONTACT.email}. We will respond within 30 days. Please tell us the email address you used, so we can find the right enquiry.`,
        'If you are not satisfied with how we have handled your request, you may complain to the Data Protection Board of India.',
      ],
    },
    {
      heading: 'Keeping it safe',
      paragraphs: [
        'The site is served only over an encrypted connection, and the database is reached over an encrypted connection too. Access to enquiries requires an administrator sign-in.',
        'No system is perfectly secure, and we will not pretend otherwise. What we can say is that we hold very little: a name, an email address and a message, and nothing that could be used to impersonate you elsewhere.',
      ],
    },
    {
      heading: 'Children',
      paragraphs: [
        'This site is not directed at children, and we do not knowingly collect information from anyone under 18. If you believe a child has sent us an enquiry, write to us and we will delete it.',
      ],
    },
    {
      heading: 'Changes to this policy',
      paragraphs: [
        'If this policy changes, the date at the top of this page changes with it. Please look here from time to time.',
      ],
    },
  ],
};

export const termsOfUse: LegalDocumentContent = {
  title: 'Terms of Use',
  lastUpdated: '30 August 2026',
  intro: [
    `These terms apply to your use of this website, operated by ${CONTACT.name}. By using the site you accept them.`,
  ],
  sections: [
    {
      heading: 'What this site is',
      paragraphs: [
        'This website is a catalogue of Rejoice’s work — gospel music, films and video production. It exists so you can find that work and get in touch about it.',
        'Every video shown here is hosted on YouTube and played through YouTube’s own player. Watching it is also subject to YouTube’s terms of service.',
      ],
    },
    {
      heading: 'Ownership of the content',
      paragraphs: [
        'The music, video, images, artwork and written material on this site belong to Rejoice Gospel Communications or to the artists, composers and writers credited alongside them. The design and code of the site itself are ours.',
        'You are welcome to watch, listen and share links. You may not copy, re-upload, edit, redistribute or use any of it commercially without our written permission — including using it as background music, in another video, or in any material of your own.',
        'If you would like to use something, ask. We would rather say yes to a request than find our work reused without one.',
      ],
    },
    {
      heading: 'Sending us an enquiry',
      paragraphs: [
        'The contact form is an invitation to start a conversation. Sending it does not create a contract, and does not oblige either of us to anything — any work we go on to do together would be agreed separately.',
        'Please send only information that is accurate and yours to send, and nothing unlawful or abusive.',
        'How we handle what you send is set out in our Privacy Policy.',
      ],
    },
    {
      heading: 'Links to other sites',
      paragraphs: [
        'This site links to YouTube and to our social media pages, and shows a map from another provider. We do not control those services and are not responsible for their content or their practices.',
      ],
    },
    {
      heading: 'Availability',
      paragraphs: [
        'We aim to keep the site available and correct, but we do not guarantee it. It may be unavailable during maintenance, or because a service we depend on has failed.',
        'The site is provided as it is, without warranties of any kind. Because the videos are hosted on YouTube, a video may be removed or made unavailable there, and it will then stop working here.',
      ],
    },
    {
      heading: 'Limitation of liability',
      paragraphs: [
        'To the extent the law allows, Rejoice Gospel Communications is not liable for any indirect or consequential loss arising from your use of this site, or from being unable to use it.',
        'Nothing in these terms limits any liability that cannot lawfully be limited.',
      ],
    },
    {
      heading: 'Governing law',
      paragraphs: [
        'These terms are governed by the laws of India. Any dispute arising from them is subject to the exclusive jurisdiction of the courts at Chennai, Tamil Nadu.',
      ],
    },
    {
      heading: 'Changes to these terms',
      paragraphs: [
        'We may update these terms. The date at the top of this page will change when we do, and continuing to use the site means you accept the revised version.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        `Questions about these terms: ${CONTACT.email}, or write to us at ${CONTACT.address}.`,
      ],
    },
  ],
};
