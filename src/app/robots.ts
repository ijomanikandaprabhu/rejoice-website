import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/seo';

/** Keep administration and API routes out of search results (section 34). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
