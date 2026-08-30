# Rejoice Website — Next.js Architecture & Standards

## 1. Project Overview

Build a modern, secure and maintainable website for **Rejoice**, a gospel music label and video production company.

The website will act as the central online presence for Rejoice and automatically display selected content from **five Rejoice YouTube channels**.

The project consists of two main areas:

### Public Website

Main navigation:

**Home | Music | Services | Channels | About | Contact**

### Admin Portal

Secure administration area accessible only by the Rejoice administrator.

Main admin navigation:

**Dashboard | YouTube Channels | YouTube Content | Website Content | Enquiries | Settings**

There is:

- No public user registration.
- No customer account system.
- No staff role system.
- No multilingual system.
- No multi-tenant system.
- No separate Videos page.
- No separate Artists page.
- No Production page.

---

# 2. Core Goals

The website must:

- Use Next.js 14+ with App Router.
- Use TypeScript.
- Be responsive across desktop, tablet and mobile.
- Provide good SEO.
- Automatically retrieve videos from five connected YouTube channels.
- Avoid uploading videos twice.
- Allow the administrator to choose which YouTube videos appear publicly.
- Allow the administrator to customize how imported videos appear on the website.
- Provide a Services page for Rejoice services.
- Provide a contact/enquiry system.
- Provide one secure administrator login.
- Follow KISS and DRY development principles.
- Keep the architecture simple enough to maintain long-term.

---

# 3. KISS and DRY

## 3.1 KISS — Keep It Simple

Use the simplest architecture that completely meets Rejoice's requirements.

Do not introduce:

- Multi-tenant architecture.
- Locale routing.
- Translation libraries.
- Complicated permission systems.
- Separate microservices without a real requirement.
- Excessive abstraction.

Pages and components should remain small and understandable.

---

## 3.2 DRY — Don't Repeat Yourself

Shared functionality should exist in one place.

Examples:

- YouTube API logic belongs in the YouTube service.
- SEO configuration belongs in central SEO helpers.
- Database access should use common repositories/services.
- Authentication logic should not be duplicated.
- Reusable UI components should be shared.
- Video display rules should be handled centrally.

---

# 4. Technology Stack

Recommended stack:

- Next.js 14+ App Router
- TypeScript
- React
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- NextAuth/Auth.js or secure custom admin session authentication
- YouTube Data API v3
- YouTube WebSub/push notifications where appropriate
- Scheduled synchronization as a backup
- Zod for request/form validation
- ESLint
- Prettier

Deployment can use Vercel or another Node.js-compatible hosting environment.

---

# 5. Public Website Structure

```txt
/
├── Home
├── Music
├── Services
├── Channels
├── About
└── Contact
```

## Home

The homepage can contain:

- Main Rejoice hero/banner
- Latest releases
- Featured releases
- Selected gospel music
- Rejoice channel highlights
- Services introduction
- About Rejoice introduction
- Contact call-to-action

Video sections must use content selected by the administrator.

---

## Music

The Music page displays YouTube content imported from the five Rejoice channels.

Possible filters can include:

- Latest
- Gospel Songs
- Worship
- Live
- Albums
- Special Programs
- Other administrator-defined categories

Only videos marked as **Visible** by the administrator should appear publicly.

---

## Services

The Services page describes services offered by Rejoice.

Examples may include:

- Music production
- Audio recording
- Mixing
- Mastering
- Gospel music production
- Video production
- Music videos
- Live event video coverage
- Promotional videos
- Lyric videos
- Post-production

Service information will be editable through Website Content in the admin portal.

---

## Channels

Displays the five official Rejoice YouTube channels.

Each channel can contain:

- Channel name
- Channel logo
- Description
- YouTube link
- Selected/latest videos from that channel

Only videos allowed by the administrator appear inside the Rejoice website.

---

## About

Contains information about:

- Rejoice
- Company history
- Mission
- Vision
- Gospel ministry/music focus
- Music and video production work

---

## Contact

Contains:

- Contact form
- Phone details
- Email
- Address if required
- Social media links
- YouTube links

Submitted contact forms appear under **Admin → Enquiries**.

---

# 6. Admin Portal

Recommended URL:

```txt
/admin
```

The `/admin` area must never be accessible without authentication.

There is only one account type:

**Administrator**

No public registration should exist.

---

# 7. Admin Navigation

```txt
Dashboard
YouTube Channels
YouTube Content
Website Content
Enquiries
Settings
Logout
```

---

# 8. Administrator Authentication

The administrator logs in using:

- Email or username
- Password

Passwords must never be stored as plain text.

Requirements:

- Secure password hashing
- HTTP-only session cookies
- CSRF protection where appropriate
- Rate limiting for login attempts
- Session expiry
- Protected `/admin/*` routes
- Protected admin APIs

Public users cannot create accounts.

There is no registration page.

---

# 9. YouTube Channel Connection

Rejoice operates five YouTube channels.

Each channel should be connected once through:

**Admin → YouTube Channels**

Administrator selects:

**Add Channel**

and enters the YouTube channel URL.

Example:

```txt
https://www.youtube.com/@RejoiceGospelCommunications
```

The backend resolves and stores the permanent YouTube Channel ID.

---

# 10. YouTube Channel Data

For each connected channel, store:

```txt
Channel ID
Channel Name
Channel URL
Channel Logo
Uploads Playlist ID
Connection Status
Last Sync Time
Default New Video Visibility
Created Date
Updated Date
```

The system should support exactly the Rejoice channels configured by the administrator rather than hardcoding them inside UI components.

---

# 11. Automatic Video Detection

The administrator should not upload a YouTube video again on the website.

The workflow is:

```txt
Video uploaded to YouTube
        ↓
Rejoice synchronization system detects it
        ↓
Video information is imported
        ↓
Video record is stored in Rejoice database
        ↓
Admin visibility/display rules are applied
        ↓
Video appears on Rejoice website if approved
```

The actual video file remains hosted on YouTube.

The Rejoice website stores only the information required to display and manage it.

---

# 12. YouTube Synchronization

Use two mechanisms.

## Primary Method — Automatic Detection

Where practical, use YouTube push/WebSub notifications to detect new uploads.

Flow:

```txt
YouTube
   ↓
Rejoice YouTube webhook
   ↓
YouTube service
   ↓
Database
   ↓
Public website
```

---

## Backup Method — Scheduled Sync

A scheduled job should periodically check all five channels.

For example:

```txt
Every 15–30 minutes
        ↓
Check five channels
        ↓
Get newest uploads
        ↓
Compare YouTube Video IDs
        ↓
Import missing videos
```

This protects the website if a push notification is missed.

---

# 13. Video Import Data

For every detected YouTube video, initially import:

```txt
YouTube Video ID
YouTube Channel ID
Original Title
Original Description
Original Thumbnail
Published Date
YouTube URL
Video Type
Imported Date
Last Synced Date
```

Do not store the actual YouTube video file.

---

# 14. Website Video Display Controls

Admin must have complete control over whether an imported video appears on the Rejoice website.

Inside:

**Admin → YouTube Content**

each video should have:

```txt
Visible / Hidden
Featured / Not Featured
Homepage / Not Homepage
Category
Display Order
```

The most important control is:

**Show on Website**

```txt
ON  = Publicly visible
OFF = Hidden from Rejoice website
```

Hiding a video from Rejoice does not delete, hide or modify the original YouTube video.

---

# 15. New Video Visibility Rule

Each connected channel should have:

**New Videos Default**

Options:

```txt
Automatically Show
Review First
```

## Automatically Show

New YouTube videos immediately appear on the website.

Admin can hide them afterward.

## Review First

New videos are automatically imported but remain hidden.

Admin must click **Show** before they become public.

For Rejoice, **Review First** is recommended because it gives the administrator complete publishing control.

---

# 16. Editing Website Display Details

YouTube information and Rejoice website information must remain separate.

Example:

### Original YouTube title

```txt
REJOICE GOSPEL COMMUNICATIONS NEW WORSHIP SONG 2026 OFFICIAL VIDEO
```

### Website display title

```txt
New Worship Release 2026
```

Changing the website title does not change the YouTube title.

---

# 17. Editable Video Fields

Admin should be able to edit:

- Website display title
- Short description
- Custom description
- Website thumbnail
- Category
- Featured status
- Homepage status
- Visibility
- Display order
- Display publish date
- Channel name visibility
- Button label
- SEO title
- SEO description

The YouTube Video ID must not be manually changed.

---

# 18. Original vs Website Values

The database should preserve both sets of data.

Example structure:

```txt
youtube_title
website_title

youtube_description
website_description

youtube_thumbnail
website_thumbnail
```

When rendering the website:

```txt
Use website_title if available.
Otherwise use youtube_title.
```

The same fallback applies to descriptions and thumbnails.

---

# 19. Reset to YouTube Details

The video editor should contain:

**Reset to YouTube Details**

This allows the administrator to remove website overrides and return to the latest imported YouTube information.

The action should not modify YouTube itself.

---

# 20. YouTube Content Admin Screen

Example:

| Video | Channel | Website | Featured | Action |
|---|---|---|---|---|
| Worship Song | Channel 1 | Showing | Yes | Edit |
| Gospel Release | Channel 2 | Hidden | No | Edit |
| Live Worship | Channel 3 | Showing | No | Edit |

Useful filters:

- All
- Visible
- Hidden
- Featured
- Channel
- Category
- Recently Imported

Search should support video title.

---

# 21. YouTube Channel Admin Screen

For each channel display:

```txt
Channel Logo
Channel Name
Connection Status
Number of Imported Videos
Last Sync
Default Visibility
```

Available actions:

```txt
Sync Now
Edit
Disconnect
```

The system should show:

```txt
Automatic Sync: ON
```

---

# 22. Website Content

Instead of separate **Homepage** and **Services** items in the admin navigation, use one section:

**Website Content**

Inside it, the administrator can manage:

### Homepage

- Hero heading
- Hero text
- Hero image
- Call-to-action
- Featured section titles
- Homepage sections
- Homepage video selections

### Services

- Service name
- Description
- Image
- Display order
- Show/hide

### About

- About Rejoice content
- Mission
- Vision
- Images

### Contact

- Phone
- Email
- Address
- Social links
- Contact page text

This keeps the main admin menu simple.

---

# 23. Enquiries

Contact form submissions should be stored in the database.

Admin can see:

```txt
Name
Email
Phone
Subject
Message
Submitted Date
Status
```

Possible statuses:

```txt
New
Read
Resolved
```

Admin should be able to:

- View enquiry
- Mark as read
- Mark as resolved
- Delete unwanted enquiry

---

# 24. Settings

Settings should contain technical/global website configuration such as:

### General

- Website name
- Logo
- Favicon
- Main contact information
- Social links

### YouTube

- API configuration status
- Automatic synchronization status
- Last successful synchronization

### SEO

- Default website title
- Default description
- Social sharing image

### Administrator

- Change admin email
- Change password

Do not place normal content editing inside Settings.

Content belongs under **Website Content**.

---

# 25. Recommended Folder Structure

```txt
src/
  app/
    (public)/
      layout.tsx
      page.tsx

      music/
        page.tsx

      services/
        page.tsx

      channels/
        page.tsx

      about/
        page.tsx

      contact/
        page.tsx

    admin/
      login/
        page.tsx

      layout.tsx
      page.tsx

      youtube-channels/
        page.tsx

      youtube-content/
        page.tsx
        [id]/
          page.tsx

      website-content/
        page.tsx

      enquiries/
        page.tsx

      settings/
        page.tsx

    api/
      auth/
      youtube/
        sync/
          route.ts
        webhook/
          route.ts
      contact/
        route.ts

    sitemap.ts
    robots.ts

  features/
    auth/
    youtube/
    content/
    enquiries/
    services/

  services/
    youtube/
      youtubeClient.ts
      channelService.ts
      videoSyncService.ts

  components/
    ui/
    layout/
    youtube/
    admin/
    common/

  lib/
    db/
    auth/
    validation/
    utils/
    logger/

  config/
    app.config.ts
    youtube.config.ts
    seo.config.ts

  prisma/
    schema.prisma

  types/
```

---

# 26. Architecture Rules

`app/` should mainly contain routing, layouts and page entry points.

Business logic should live under:

```txt
features/
services/
lib/
```

YouTube API calls must not be written directly inside React components.

Correct flow:

```txt
UI
 ↓
Server Action / Route Handler
 ↓
YouTube Feature Service
 ↓
YouTube API Client
 ↓
YouTube API
```

---

# 27. Suggested Core Database Models

Recommended entities:

```txt
Admin
YouTubeChannel
YouTubeVideo
VideoCategory
WebsiteContent
Service
Enquiry
SiteSetting
```

---

# 28. YouTubeChannel Model Concept

```txt
id
youtubeChannelId
name
url
thumbnail
uploadsPlaylistId
isActive
defaultVideoVisibility
lastSyncedAt
createdAt
updatedAt
```

---

# 29. YouTubeVideo Model Concept

```txt
id

youtubeVideoId
channelId

youtubeTitle
youtubeDescription
youtubeThumbnail
youtubePublishedAt

displayTitle
displayDescription
displayThumbnail

categoryId

isVisible
isFeatured
showOnHomepage

displayOrder

importedAt
lastSyncedAt
createdAt
updatedAt
```

`youtubeVideoId` must be unique.

This prevents the same YouTube video from being imported multiple times.

---

# 30. Service Model Concept

```txt
id
title
description
image
displayOrder
isVisible
createdAt
updatedAt
```

---

# 31. Enquiry Model Concept

```txt
id
name
email
phone
subject
message
status
createdAt
```

---

# 32. SEO

The website uses one primary language.

There is no:

- `[locale]` routing.
- Locale switching.
- Translation JSON files.
- hreflang generation.
- Localized metadata.
- Localized sitemap.

SEO should instead focus on:

- Unique page titles
- Meta descriptions
- Canonical URLs
- Open Graph metadata
- Twitter/social metadata
- Structured data where appropriate
- `sitemap.xml`
- `robots.txt`
- Video-friendly metadata
- Fast page loading
- Mobile responsiveness

Admin routes must be excluded from search indexing.

---

# 33. Sitemap

The sitemap should include public pages such as:

```txt
/
 /music
 /services
 /channels
 /about
 /contact
```

Dynamic public content can also be included where appropriate.

Never include:

```txt
/admin
/admin/*
/api/*
```

---

# 34. Robots

Search engines should be prevented from indexing administration routes.

Example concept:

```txt
Disallow: /admin/
Disallow: /api/
```

---

# 35. Performance

Prefer Next.js Server Components where appropriate.

Important performance requirements:

- Optimize images.
- Lazy-load YouTube embeds.
- Do not load five channels' entire libraries on the homepage.
- Paginate or progressively load Music content.
- Cache safe YouTube API responses.
- Serve public pages from database content rather than requesting YouTube on every visitor request.

The website should display data from the Rejoice database.

YouTube synchronization happens separately.

Correct architecture:

```txt
YouTube
   ↓
Synchronization
   ↓
Rejoice Database
   ↓
Rejoice Website
```

Avoid:

```txt
Visitor
   ↓
Website
   ↓
YouTube API on every page request
```

---

# 36. Reliability

The synchronization service must:

- Prevent duplicate imports.
- Log synchronization errors.
- Record last successful sync.
- Continue processing other channels if one channel fails.
- Retry temporary failures.
- Respect YouTube API quota.
- Never remove website customizations during a synchronization.

If a YouTube title changes later, update the stored original YouTube title while preserving the administrator's `displayTitle`.

---

# 37. Security

Requirements:

- Protect all `/admin/*` routes.
- Protect admin API endpoints.
- Hash passwords securely.
- Use secure HTTP-only cookies.
- Validate all form submissions.
- Validate uploaded images.
- Rate-limit authentication endpoints.
- Rate-limit public contact forms.
- Sanitize content where necessary.
- Keep API keys server-side.
- Never expose the YouTube API key in client-side code.
- Never store YouTube channel passwords.
- Never request administrator YouTube passwords.

---

# 38. Testing

Add unit tests for:

- Video import logic
- Duplicate detection
- Show/hide rules
- Display override fallback
- YouTube synchronization
- Authentication
- Contact form validation

Add end-to-end tests for:

```txt
Admin Login
Connect YouTube Channel
Automatic Video Import
Show Video
Hide Video
Edit Display Details
Reset YouTube Details
Homepage Content Editing
Contact Enquiry
Logout
```

---

# 39. Important Video Rules

These rules are mandatory:

### Rule 1

YouTube is the video hosting platform.

### Rule 2

Rejoice does not upload duplicate video files to its website.

### Rule 3

All five configured channels can automatically synchronize.

### Rule 4

Every imported video has an independent website visibility setting.

### Rule 5

Administrator can hide a video without affecting YouTube.

### Rule 6

Administrator can edit website display information without affecting YouTube.

### Rule 7

Automatic YouTube synchronization must not overwrite administrator display overrides.

### Rule 8

The YouTube Video ID is the permanent connection between the imported record and the original video.

---

# 40. Final User Flow

## Publishing a New Video

```txt
Rejoice uploads video to YouTube
              ↓
Website automatically detects video
              ↓
Video imported into Rejoice database
              ↓
If channel = Auto Show
    → Video becomes public

If channel = Review First
    → Video remains hidden
              ↓
Admin can edit display details
              ↓
Admin selects Show
              ↓
Video appears on Rejoice website
```

---

# 41. Final Admin Structure

```txt
ADMIN

Dashboard

YouTube Channels
 ├── Connect Channel
 ├── Sync Channel
 ├── Default Visibility
 └── Connection Status

YouTube Content
 ├── Search
 ├── Filter
 ├── Show / Hide
 ├── Edit Display Details
 ├── Featured
 ├── Homepage
 ├── Categories
 └── Reset to YouTube Details

Website Content
 ├── Home
 ├── Services
 ├── About
 └── Contact

Enquiries
 ├── New
 ├── Read
 └── Resolved

Settings
 ├── General
 ├── YouTube
 ├── SEO
 └── Administrator

Logout
```

---

# 42. Final Public Website Structure

```txt
PUBLIC WEBSITE

Home

Music

Services

Channels

About

Contact
```

This is the baseline architecture for the **Rejoice Gospel Music & Video Production website**.

Any future feature should first be checked against two questions:

**Does Rejoice actually need it?**

**Can it be implemented more simply?**

The goal is a focused, reliable website rather than an unnecessarily complex enterprise platform.