/**
 * Website copy.
 *
 * This is the content of the public pages. It lives in code rather than in the
 * database because it changes rarely and is edited by whoever is already working
 * on the site — a whole admin screen and a table were not worth the round-trip
 * on every page load.
 *
 * Editing anything here needs a redeploy. Things that must change at runtime
 * live in the admin instead:
 *
 *   - contact email, phone and address  → Settings → General
 *   - which videos are public           → YouTube Content
 */

export type HomeContent = {
  heroHeading: string;
  heroText: string;
  /** Leave empty to use the ember gradient. */
  heroImage: string;
  /**
   * Track for the hero record player. A path under `public/` (for example
   * `/media/track.mp3`) or a full URL — it is handed straight to `<audio src>`,
   * which does not care which, so the file can move to a CDN later without a
   * code change. Leave empty to hide the player entirely.
   */
  heroAudio: string;
  /**
   * Statement line between the hero and the channel rails, rendered with a
   * sweeping ember gradient. A `
` forces a line break — the wording is set
   * as two deliberate lines rather than left to wrap wherever the width
   * happens to fall. Leave empty to hide the section entirely.
   */
  shinyText: string;
  ctaLabel: string;
  ctaHref: string;
  /** Heading over the channel spotlight. Empty hides it, as the others do. */
  spotlightHeading: string;
  servicesHeading: string;
  servicesIntro: string;
  aboutHeading: string;
  aboutIntro: string;
  contactHeading: string;
  contactText: string;
  /** Eyebrow and heading for the platform ring. Empty heading hides the section. */
  platformsEyebrow: string;
  platformsHeading: string;
  /** Eyebrow and heading for the services bento. Empty heading hides the section. */
  /**
   * The band of newest song covers, above the services bento. Empty hides the
   * section, as the others do.
   */
  songsEyebrow: string;
  songsHeading: string;
  servicesBentoEyebrow: string;
  servicesBentoHeading: string;
};

/**
 * One card in the "Rejoice services" bento block on the homepage.
 *
 * `variant` picks the animated mark; the four available are defined in
 * globals.css under "Bento card icons".
 */
export type BentoCard = {
  id: string;
  meta: string;
  title: string;
  description: string;
  variant: 'orbit' | 'relay' | 'wave' | 'spark';
  /** Where the card leads. Omit for a card that is display only. */
  href?: string;
};

/** One tile in the "listen everywhere" ring on the homepage. */
export type Platform = {
  name: string;
  /**
   * Path under `public/` to the platform's logo, e.g.
   * `/brand/platforms/spotify.svg`. Leave empty and the tile shows the name
   * instead — that is the placeholder until the real logo files are added, and
   * dropping a file in here is the only change needed to swap one over.
   */
  logo?: string;
  /**
   * The Rejoice profile on that platform. EMPTY until the links are supplied —
   * a card without one renders as a plain logo rather than a dead link, so
   * pasting a URL in here is the only change needed to make it clickable.
   */
  url?: string;
};

export type ContactCopy = {
  heading: string;
  text: string;
};

/**
 * One offering on the Services page.
 *
 * Richer than a card: each offering carries its own headline, two paragraphs, a
 * long list of specific services, a closing line and its own call to action.
 * The supplied copy numbered these 01-04; the numbers are deliberately not
 * stored, so the order on the page comes from this array alone.
 */
export type Service = {
  /** Anchor id, so a section can be linked to directly. */
  id: string;
  title: string;
  headline: string;
  lead: string;
  body: string;
  /** The specific services offered under this heading. */
  items: string[];
  /** The line that follows the list. */
  closing: string;
  ctaLabel: string;
  /** Tagged per section, so an enquiry can be traced back to the offering. */
  ctaHref: string;
  /** Leave empty to render the placeholder panel instead of a photograph. */
  image?: string;
};

export const homeContent: HomeContent = {
  /*
   * The escapes are DELIBERATE LINE BREAKS, not formatting of this file: the
   * heading is set as three lines rather than left to wrap wherever the width
   * happens to fall. `whitespace-pre-line` on the `h1` is what honours them —
   * take that class away and the breaks collapse to spaces.
   *
   * They are MINIMUMS. A line still wraps further on a narrow screen, which is
   * why the middle line is written as a whole thought on its own.
   *
   * Same mechanism as `platformsHeading` and `shinyText` below.
   */
  heroHeading:
    'Enjoy listening!\nExperience the joy of Gospel music\nthrough our diverse creations.',
  heroText:
    'Rejoice is a gospel music label and video production company. We record, produce and film worship music across five YouTube channels.',
  heroImage: '',
  heroAudio: '/media/Hero-Audio-UMMAI-ARATHIPPEN.mp3',
  shinyText: 'Faith Comes\nAlive Here',
  ctaLabel: 'Listen now',
  ctaHref: '/songs',
  spotlightHeading: 'New Releases',
  servicesHeading: 'What we do',
  servicesIntro:
    'From recording and mixing through to music videos and live event coverage, Rejoice handles the whole production.',
  aboutHeading: 'About Rejoice',
  aboutIntro: 'We exist to serve gospel ministry through excellent music and video production.',
  contactHeading: 'Work with us',
  contactText: 'Tell us about your project and we will get back to you.',
  platformsEyebrow: 'Listen everywhere',
  // The `\n` keeps this as two deliberate lines inside the ring rather than
  // letting it wrap wherever the circle happens to be narrowest.
  platformsHeading: 'Your Favourite Songs,\nWherever You Are',
  /*
   * NOT "New Releases" — `spotlightHeading` above already carries that, over
   * the channel spotlight, and two sections on one page under the same words
   * would read as the same thing shown twice.
   */
  songsEyebrow: 'New music',
  songsHeading: 'Songs We Just Released',
  servicesBentoEyebrow: 'Rejoice services',
  servicesBentoHeading: 'From Vision to Meaningful Creation',
};

/**
 * Streaming platforms carrying Rejoice music, shown in the homepage ring.
 *
 * Order here is the order they fan out in, going clockwise from the right.
 * Every `logo` is empty for now, so each tile renders its name — see the
 * `Platform` type above for how to swap in the real marks.
 */
export const platforms: Platform[] = [
  { name: 'Spotify', logo: '/brand/platforms/spotify.png', url: '' },
  { name: 'Apple Music', logo: '/brand/platforms/apple-music.png', url: '' },
  { name: 'iTunes', logo: '/brand/platforms/itunes.png', url: '' },
  { name: 'Amazon Music', logo: '/brand/platforms/amazon-music.png', url: '' },
  { name: 'JioSaavn', logo: '/brand/platforms/jiosaavn.png', url: '' },
  { name: 'Gaana', logo: '/brand/platforms/gaana.png', url: '' },
  { name: 'Raaga', logo: '/brand/platforms/raaga.png', url: '' },
  { name: 'Resso', logo: '/brand/platforms/resso.png', url: '' },
  { name: 'Wynk', logo: '/brand/platforms/wynk.png', url: '' },
  { name: 'YouTube Music', logo: '/brand/platforms/youtube-music.png', url: '' },
];

/**
 * The interactive heading on the Channels page — each letter lifts under the
 * pointer. A `\n` splits it into two deliberate lines; the break is explicit
 * rather than left to wrapping, because the line length is what sets the type
 * size. Leave empty to hide it.
 */
export const channelsHoverLine = 'Stories, Worship & Songs\nFor Everyone';

/**
 * The Services page, in order. Not used anywhere else - the homepage's bento
 * block reads `bentoCards`, which is edited separately.
 */
export const services: Service[] = [
  {
    id: 'audio-production',
    title: 'Audio Production',
    headline: 'Bring Your Sound to Life',
    lead: 'From the first idea to the final master, we create professional audio that connects with listeners and communicates your vision.',
    body: 'Our audio production services support artists, ministries, churches, creators, and organizations looking for high-quality sound with creative attention at every stage.',
    items: [
      'Music Production',
      'Song Arrangement',
      'Recording',
      'Vocal Production',
      'Instrument Programming',
      'Editing & Vocal Tuning',
      'Mixing',
      'Mastering',
      'Background Scores',
      'Instrumental Production',
      'Worship Music Production',
      'Gospel Music Production',
      'Voice-over Recording',
      'Podcast & Spoken Audio Production',
    ],
    closing:
      'Have a song or audio project in mind? Let’s turn your idea into a sound worth sharing.',
    ctaLabel: 'Start Your Audio Project',
    ctaHref: '/contact?service=audio-production',
  },
  {
    id: 'video-production',
    title: 'Video Production',
    headline: 'Stories Made to Be Seen',
    lead: 'We transform ideas, music, messages, and stories into engaging visual experiences.',
    body: 'From concept development and filming to editing and final delivery, Rejoice provides complete video production for artists, ministries, brands, churches, and creative projects.',
    items: [
      'Music Videos',
      'Worship Videos',
      'Gospel Videos',
      'Promotional Videos',
      'Story-Based Videos',
      'Kids Content',
      'Christian & Faith-Based Content',
      'Studio Video Production',
      'Multi-Camera Production',
      'Video Editing',
      'Colour Grading',
      'Motion Graphics',
      'Lyric Videos',
      'Social Media Videos',
      'YouTube Content',
      'Short-Form Videos & Reels',
    ],
    closing:
      'Every frame is created to communicate your message with clarity, creativity, and emotion.',
    ctaLabel: 'Start Your Video Project',
    ctaHref: '/contact?service=video-production',
  },
  {
    id: 'ai-audio-production',
    title: 'AI Audio Production',
    headline: 'New Technology. New Creative Possibilities.',
    lead: 'Explore a new generation of audio creation with AI-assisted production.',
    body: 'Rejoice combines creative direction, music knowledge, and artificial intelligence to develop unique audio experiences faster while keeping the human vision at the heart of the project.',
    items: [
      'AI-Assisted Music Creation',
      'AI Song Concept Development',
      'AI Instrumental Creation',
      'AI Background Music',
      'AI-Assisted Arrangements',
      'AI Voice & Vocal Production',
      'Voice Transformation',
      'Multilingual Audio Creation',
      'AI Demos & Music Concepts',
      'Audio Enhancement',
      'Creative Sound Experiments',
      'AI-Assisted Mixing & Production',
    ],
    closing:
      'AI is a creative tool. Your idea, message, and direction remain at the centre of every production.',
    ctaLabel: 'Explore AI Audio',
    ctaHref: '/contact?service=ai-audio-production',
  },
  {
    id: 'ai-video-production',
    title: 'AI Video Production',
    headline: 'Imagine It. Create It.',
    lead: 'Turn concepts that once seemed impossible into visual stories using the latest AI-powered video technology.',
    body: 'We combine AI generation with creative direction, editing, storytelling, sound, and post-production to build distinctive visual content for music, ministries, brands, children’s content, and digital platforms.',
    items: [
      'AI-Generated Videos',
      'AI Music Videos',
      'AI Storytelling',
      'AI Animation',
      'Kids Animation & Stories',
      'Character-Based Videos',
      'Concept & Fantasy Visuals',
      'AI Lyric Videos',
      'AI Promotional Videos',
      'AI Social Media Content',
      'Image-to-Video Creation',
      'AI Visual Effects',
      'AI-Assisted Video Editing',
      'Custom Creative Concepts',
    ],
    closing:
      'From a simple idea to an entire visual world, we help turn imagination into content people can experience.',
    ctaLabel: 'Create With AI',
    ctaHref: '/contact?service=ai-video-production',
  },
];

/**
 * The four cards under the platform ring on the homepage.
 *
 * DERIVED from `services`, not written again: the homepage promises what the
 * Services page delivers, so the copy exists once and a change there follows
 * here. Two things are not in `services` because they are presentation rather
 * than content — the short pill label and which of the four marks in
 * globals.css the card draws — so they live in the lookup below.
 */
const BENTO_PRESENTATION: Record<string, { meta: string; variant: BentoCard['variant'] }> = {
  'audio-production': { meta: 'Audio', variant: 'orbit' },
  'video-production': { meta: 'Video', variant: 'relay' },
  'ai-audio-production': { meta: 'AI Audio', variant: 'wave' },
  'ai-video-production': { meta: 'AI Video', variant: 'spark' },
};

export const bentoCards: BentoCard[] = services.map((service) => ({
  /*
   * The service's own id, not a positional "01".."04". That numbering existed
   * only to be displayed on the card; with it gone, a position-derived key
   * would just be a fossil — and the wrong thing to key on, since reordering
   * `services` would have React reuse the wrong nodes.
   */
  id: service.id,
  meta: BENTO_PRESENTATION[service.id]?.meta ?? service.title,
  title: service.title,
  description: service.lead,
  variant: BENTO_PRESENTATION[service.id]?.variant ?? 'orbit',
  href: `/services#${service.id}`,
}));

/**
 * The Services page header. Its closing block is no longer here — every public
 * page now ends on the shared `ctaPanels` entry below.
 */
export const servicesPage = {
  eyebrow: 'Services',
  heading: 'Creative Production. Powered by Purpose.',
  intro: [
    'From traditional studio production to the latest AI-powered creative tools, Rejoice helps bring ideas to life through sound, visuals, storytelling, and technology.',
    'Whether you are creating a song, worship project, music video, promotional content, animation, or an AI-powered production, our team works with you from concept to final delivery.',
  ],
} as const;

/**
 * The closing panel on each public page. An empty heading hides the panel, so a
 * page can be opted out from here without touching its code. A \n in the
 * heading is a deliberate line break.
 */
export const ctaPanels = {
  home: {
    heading: 'Ready to Hear\nWhat We Make?',
    text: 'Thousands of listeners already follow the Rejoice channels. Start with the latest release and work backwards.',
    ctaLabel: 'Listen now',
    ctaHref: '/songs',
  },
  music: {
    heading: 'Want Your Song\nMade Like This?',
    text: 'Every release here started as an idea someone brought to us. Tell us yours and we will find the right way to record it.',
    ctaLabel: 'Start a project',
    ctaHref: '/contact',
  },
  channels: {
    heading: 'Ready to Reach\nYour Audience?',
    text: 'We produce, publish and grow gospel content across every one of these channels. The same can be done for yours.',
    ctaLabel: 'Talk to us',
    ctaHref: '/contact',
  },
  services: {
    heading: 'Have an Idea?\nLet’s Create It.',
    text: 'Whether your project begins with a melody, a message, a story, or simply an idea, Rejoice can help you find the right way to bring it to life.',
    ctaLabel: 'Discuss Your Project',
    ctaHref: '/contact',
  },
  about: {
    heading: 'Ready to Make\nSomething Together?',
    text: 'Bring a song, a service, a story or a rough idea. We will tell you honestly what it needs.',
    ctaLabel: 'Discover Rejoice',
    ctaHref: '/creations',
  },
} as const;

/**
 * The About page.
 *
 * Eleven sections, each with its own shape on the page. The prose here is the
 * supplied copy VERBATIM — an earlier pass paraphrased it from a design outline
 * and lost most of it, so nothing in this object is rewritten.
 *
 * Media paths are EMPTY on purpose: every slot renders a deliberate fallback
 * until a file is supplied, and filling one in here swaps it without touching a
 * component.
 */
export const aboutPage = {
  hero: {
    eyebrow: 'About us',
    heading: 'Faith in Every Note. Purpose in Every Story.',
    paragraphs: [
      'Rejoice Gospel Communications was founded with a simple but powerful vision: to use music and creative media as a way to share the message of faith, hope, love, and redemption.',
      'Since 2003, Rejoice has grown from a heartfelt mission to promote Christian music into a creative gospel communication platform reaching people across generations.',
    ],
    badge: 'Since 2003',
    /** An image or an .mp4. Empty renders the ember gradient instead. */
    media: '',
  },

  story: {
    eyebrow: 'Our story',
    heading: 'A Vision Born from Faith',
    paragraphs: [
      'At a time when Christian artists and gospel music had limited opportunities to reach wider audiences, Mr. Robin Nazeren envisioned something different.',
      'Rather than allowing meaningful songs and messages to remain unheard, he established Rejoice Gospel Communications as a platform dedicated to bringing Christian music to people and helping emerging voices find an audience.',
      'His vision was never simply about producing songs. It was about using creativity as a ministry, allowing music to carry messages of hope, encouragement, compassion, worship, and the love of God into homes and hearts.',
    ],
    closing: 'What began with music gradually became something much greater.',
  },

  founder: {
    eyebrow: 'Our founder',
    heading: 'A Calling Beyond Business',
    /*
     * FIRST PERSON, because it is attributed. It read "For Mr. Robin
     * Nazeren, Rejoice was never created..." underneath a byline naming him,
     * so the founder appeared to be speaking about himself in the third
     * person. A quote and its attribution have to agree.
     */
    quote:
      'For me, Rejoice was never created simply as a commercial venture. It was born from a deep sense of calling and service.',
    attribution: 'Mr. Robin Nazeren, Founder',
    paragraphs: [
      'Throughout the early journey, financial limitations, practical challenges, and the difficulties of building a Christian creative platform tested that vision. Yet the mission remained unchanged.',
      'Robin believed that if meaningful Christian songs were given the opportunity to be heard, they could encourage people, strengthen families, inspire communities, and guide hearts toward God.',
      'That conviction became the foundation on which Rejoice was built.',
      'His dedication to supporting and promoting gospel music reflected a purpose greater than financial reward: to serve through creativity and help messages of faith reach the people who needed to hear them.',
    ],
    /** Portrait. Empty leads with the quote instead. */
    portrait: '',
  },

  timeline: {
    eyebrow: 'The journey',
    heading: '2003 → Today',
    milestones: [
      {
        year: '2003',
        title: 'Gospel Music',
        text: 'A platform to give Christian songs somewhere to be heard.',
      },
      {
        year: 'Growth',
        title: 'Recording & Production',
        text: 'Studio work, arrangement and production for artists and ministries.',
      },
      {
        year: 'Digital Era',
        title: 'YouTube & Online Ministry',
        text: 'Channels carrying worship to audiences anywhere.',
      },
      {
        year: 'Today',
        title: 'Music · Video · Animation · AI',
        text: 'New formats, the same message.',
      },
    ],
  },

  grid: {
    eyebrow: 'More than music',
    heading: 'Sharing the Gospel Through Creativity',
    paragraphs: [
      'The world of communication has changed dramatically since Rejoice began, and so has the way we tell stories.',
      'Today, Rejoice continues its original mission through a growing range of creative expressions, from gospel music and worship to instrumentals, children’s stories, animation, video production, and emerging AI-powered creative experiences.',
    ],
    /** Set apart from the paragraphs, in larger type. */
    // "Different formats. Different generations. One purpose." is the Vision
    // section's heading in other words; this is the half that is not.
    pull: 'To communicate faith in ways that people can hear, see, feel, and remember.',
    closing:
      'Whether it is a worship song that brings someone closer to God, a children’s story that introduces a young heart to faith, or a visual experience that communicates a powerful message, every creation has the opportunity to touch a life.',
    cards: [
      {
        id: 'worship',
        title: 'Worship & Gospel',
        text: 'Songs, worship projects and live recordings made with artists and ministries.',
        /** Falls back to the isometric scene named by `id`. */
        image: '/about/worship-gospel.webp',
      },
      {
        id: 'kids',
        title: 'Kids & Stories',
        text: 'Animation and stories that introduce young hearts to faith.',
        image: '/about/kids-stories.webp',
      },
      {
        id: 'film',
        title: 'Film & Video',
        text: 'Music videos, promotional films and story-based production from concept to delivery.',
        image: '/about/film-video.webp',
      },
      {
        id: 'ai',
        title: 'AI Creativity',
        text: 'New tools for audio and visual creation, with the human vision still at the centre.',
        image: '/about/ai-creativity.webp',
      },
    ],
  },

  mission: {
    eyebrow: 'Our mission',
    heading: 'Creating With Purpose',
    statement:
      'Our mission is to use music, storytelling, technology, and visual communication to create meaningful Christian content that inspires faith and reaches every generation.',
    principles: [
      { title: 'Faith', text: 'Rooted in the message.' },
      { title: 'Creativity', text: 'Finding meaningful ways to communicate.' },
      { title: 'Purpose', text: 'Creating work that can touch lives.' },
    ],
    seekLabel: 'We seek to:',
    seek: [
      'Support and encourage Christian creative voices.',
      'Produce meaningful gospel and worship content.',
      'Share messages of hope, love, faith, and redemption.',
      'Create inspiring content for children and families.',
      'Use new technology without losing the heart of the message.',
      'Bring high-quality Christian content to audiences around the world.',
      'Create work that serves both ministry and people.',
    ],
  },

  heart: {
    eyebrow: 'Our heart',
    heading: 'Every Creation Can Carry a Message',
    lead: 'We believe creativity has the power to go where words alone sometimes cannot.',
    lines: [
      'A melody can bring comfort.',
      'A story can plant a seed of faith.',
      'A visual can make a message unforgettable.',
      'A child can discover biblical truth through animation.',
      'A worship song can become someone’s prayer.',
    ],
    bridge:
      'This is why every project at Rejoice begins with more than an idea. It begins with a purpose.',
    closing: ['We create to inspire.', 'We create to encourage.', 'We create to communicate hope.'],
  },

  future: {
    eyebrow: 'Growing with every generation',
    heading: 'Timeless Message. New Ways to Tell It.',
    paragraphs: [
      'Rejoice began in a different era of media, but its purpose continues to guide everything we do today.',
      // The list of formats was here in full, and the strip directly beneath
      // this paragraph shows the same sequence — the sentence and the graphic
      // were saying the same thing side by side.
      "From traditional music production to today's AI-assisted tools, we continue to explore new ways of communicating timeless truths.",
    ],
    /** Short stepped lines, one per line. */
    changes: [
      'Technology may change.',
      'Platforms may change.',
      'The way people consume content may change.',
      'But the message of hope remains.',
    ],
    closing:
      'Our responsibility is to carry that message forward in ways that speak to today’s generation while remaining rooted in the faith that began our journey.',
    steps: ['Audio', 'Video', 'Animation', 'Digital', 'AI'],
  },

  vision: {
    eyebrow: 'Our vision',
    heading: 'One Message. Many Expressions.',
    words: ['Music', 'Stories', 'Visuals', 'Technology'],
    paragraphs: [
      'We envision Rejoice as a creative home where faith and imagination meet, a place where songs, stories, visuals, technology, and talented people come together to create something meaningful.',
      'Our hope is to continue building a platform that connects generations through Christian creativity and allows the message of the Gospel to travel beyond boundaries.',
      'From a song heard through headphones to a story watched by a child, every piece of content can become part of something greater.',
    ],
  },

  closing: {
    eyebrow: 'This is Rejoice',
    intro: [
      'More than a music label.',
      'More than a production company.',
      'A creative ministry built to communicate hope.',
    ],
    paragraphs: [
      'Since 2003, our journey has been shaped by faith, creativity, perseverance, and a desire to serve.',
      'And as new voices, new stories, and new technologies emerge, our purpose remains the same:',
    ],
    lines: [
      'To create with faith.',
      'To communicate with purpose.',
      'And to give every heart a reason to Rejoice.',
    ],
  },
} as const;

/**
 * The Contact page.
 *
 * The direct details (email, phone, address) are NOT here — they live in
 * Admin → Settings → Contact details, so an administrator can change them
 * without a deploy. Only wording lives in this file.
 */
export const contactPage = {
  hero: {
    eyebrow: 'Contact us',
    heading: 'Let’s Create Something Meaningful Together.',
    paragraphs: [
      'Have a song, story, video, ministry project, collaboration, or creative idea in mind? We’d love to hear from you.',
      'At Rejoice Gospel Communications, we bring ideas to life through music, video, storytelling, animation, and AI-powered creative production, all with purpose at the heart of what we create.',
    ],
    closing: 'Let’s start a conversation.',
  },

  form: {
    eyebrow: 'Get in touch',
    heading: 'Tell Us About Your Idea',
    paragraphs: [
      'Whether you already have a complete project in mind or are just beginning with an idea, share it with us.',
      'Our team will connect with you to understand your vision and explore the right creative direction for your project.',
    ],
  },

  details: {
    eyebrow: 'Connect with Rejoice',
    heading: 'Rejoice Gospel Communications',
    text: 'For production enquiries, collaborations, partnerships, ministry projects, or general questions, you can reach us directly.',
    labels: { address: 'Visit Us', phone: 'Call Us', email: 'Email Us' },
  },

  /**
   * The studio's location, for the contact page map.
   *
   * Coordinates rather than the address string: a text search can resolve to a
   * different match — there is more than one "Ram Nagar North" — whereas a
   * lat/lng pins the exact door. Taken from the Google Maps place link.
   */
  map: {
    lat: 12.9662905,
    lng: 80.2094116,
    zoom: 16,
  },

  closing: {
    heading: 'Every Great Creation Begins\nWith a Conversation.',
    paragraphs: [
      'You don’t need to have everything figured out before reaching out.',
      'Bring us your song, message, story, vision, or even a simple idea, and let’s discover what it can become.',
    ],
    line: 'Create with faith. Communicate with purpose.',
  },
} as const;

/**
 * The enquiry form.
 *
 * `interests` fills the "I’m Interested In" select. The chosen value is stored
 * on the enquiry’s EXISTING `subject` column, so adding these options needed no
 * migration and the admin list shows them without change.
 */
export const contactForm = {
  fields: {
    name: { label: 'Name', placeholder: 'Enter your name' },
    email: { label: 'Email Address', placeholder: 'Enter your email address' },
    phone: { label: 'Phone Number', placeholder: 'Enter your contact number' },
    interest: { label: 'I’m Interested In', placeholder: 'Select an option' },
    message: {
      label: 'Tell Us About Your Project',
      placeholder: 'Share your idea, requirements, or vision with us.',
    },
  },
  interests: [
    'Audio Production',
    'Video Production',
    'AI Audio Production',
    'AI Video Production',
    'Collaboration',
    'Ministry / Gospel Project',
    'General Enquiry',
  ],
  submitLabel: 'Send Enquiry',
} as const;

/**
 * The Music page.
 *
 * A directory of where Rejoice can be heard, not a catalogue: the videos live
 * on the Channels page and their own /songs/[id] pages. The logos and links
 * come from `platforms` above, which also feeds the homepage ring — one list,
 * two presentations.
 */
export const musicPage = {
  /**
   * The hand reaching into the light, as a CUT-OUT with a transparent
   * background — the light shaft behind it is built in CSS, so a photograph
   * with its own background would cover it.
   *
   * Drop the file at `public/media/music-hero-hand.webp` and put that path here.
   * Left empty the hero still reads as finished: the beam and the type carry
   * it, the same way an empty `logo` on a platform falls back to its name.
   */
  heroImage: '/media/music-hero-hand.webp',
  eyebrow: 'Listen to Rejoice',
  heading: 'Your Favourite Songs. Your Favourite Platform.',
  text: 'Listen to Rejoice Gospel Communications wherever you enjoy music. Choose your preferred platform below and continue listening there.',
  gridHeading: 'Latest Releases',
  closing: 'Open any release to find it on your platform of choice.',
  line: 'Songs that inspire faith, bring hope, and give every heart a reason to Rejoice.',
} as const;
